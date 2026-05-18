-- Migration 004: Multi-source confirmation for investment_opportunities
--
-- Problem: investment_opportunities.source is a single TEXT column.
-- When Patreon, Discord, and a 13F filing all flag the same asset,
-- they create 3 separate rows instead of strengthening one idea.
--
-- Solution:
--   1. Add sources TEXT[] column — array of all source names confirming this idea
--   2. Add confirmed_by_count INT — denormalised count for fast leaderboard sort
--   3. Add source_details JSONB — per-source metadata (score contribution, url, author)
--   4. Keep source TEXT for backwards compat (primary/first source)
--   5. Update public_opportunity_action_board view to expose new columns
--   6. Add merge function: when a duplicate symbol arrives from a new source,
--      add the source to existing row rather than creating a new one

-- Step 1: Add columns to investment_opportunities
alter table investment_opportunities
  add column if not exists sources          text[]  not null default '{}',
  add column if not exists confirmed_by_count int   not null default 1,
  add column if not exists source_details   jsonb  not null default '[]'::jsonb;

-- Backfill: existing rows get their current source into the sources array
update investment_opportunities
set sources = array[source]
where sources = '{}' and source is not null and source != '';

-- Index for multi-source queries
create index if not exists io_sources_gin_idx
  on investment_opportunities using gin(sources);

create index if not exists io_confirmed_count_idx
  on investment_opportunities(confirmed_by_count desc, total_score desc);

-- Step 2: Function to add a new source confirmation to an existing idea
-- Called when the same symbol arrives from a different source.
-- Updates: sources array, confirmed_by_count, total_score boost, source_details.
create or replace function add_source_confirmation(
  p_opportunity_id text,
  p_source         text,
  p_source_url     text    default null,
  p_source_author  text    default null,
  p_score_contrib  numeric default 0,
  p_notes          text    default null
) returns void language plpgsql as $$
begin
  -- Only add if not already in sources array
  if not exists (
    select 1 from investment_opportunities
    where id = p_opportunity_id
      and p_source = any(sources)
  ) then
    update investment_opportunities
    set
      sources           = array_append(sources, p_source),
      confirmed_by_count = confirmed_by_count + 1,
      -- Boost total_score by up to 10 points per additional source (diminishing returns)
      total_score = least(100, total_score + greatest(0, 10 - (confirmed_by_count - 1) * 2)),
      source_details = source_details || jsonb_build_object(
        'source',       p_source,
        'source_url',   p_source_url,
        'author',       p_source_author,
        'score_contrib',p_score_contrib,
        'notes',        p_notes,
        'confirmed_at', now()
      ),
      updated_at = now()
    where id = p_opportunity_id;
  end if;
end;
$$;

-- Step 3: Function to find an existing active idea for a symbol
-- Returns the opportunity_id if one exists with matching symbol + direction,
-- or NULL if none found. Used by the bot before creating a new row.
create or replace function find_existing_opportunity(
  p_symbol    text,
  p_direction text default 'long'
) returns text language sql stable as $$
  select id
  from investment_opportunities
  where normalized_symbol = upper(p_symbol)
    and direction = p_direction
    and action_state not in ('invalidated', 'expired')
    and deleted_at is null
  order by total_score desc, updated_at desc
  limit 1;
$$;

-- Step 4: Update the public view to expose new columns
-- Drop and recreate the view (Postgres doesn't allow add column on views)
drop view if exists public_opportunity_action_board;

create or replace view public_opportunity_action_board as
select
  row_number() over (order by
    case action_state
      when 'ready'          then 1
      when 'wait_for_entry' then 2
      when 'chasing_risk'   then 3
      else 4
    end,
    total_score desc nulls last,
    confirmed_by_count desc,
    updated_at desc nulls last
  ) as state_rank,
  io.id,
  io.source,
  io.sources,
  io.confirmed_by_count,
  io.source_details,
  io.source_record_id,
  io.symbol,
  io.normalized_symbol,
  io.title,
  io.thesis,
  io.direction,
  io.asset_class,
  io.status,
  io.action_state,
  io.lifecycle,
  io.total_score,
  io.thesis_score,
  io.entry_score,
  io.risk_reward_score,
  io.catalyst_score,
  io.source_score,
  io.liquidity_score,
  io.portfolio_fit_score,
  io.current_price,
  io.ideal_entry,
  io.entry_min,
  io.entry_max,
  io.do_not_chase_above,
  io.stop_loss,
  io.take_profit_1,
  io.take_profit_2,
  io.take_profit_3,
  io.trailing_exit_trigger,
  io.invalidation,
  io.why_now,
  io.next_action,
  io.what_to_watch,
  io.source_url,
  io.is_tracked,
  io.is_watchlisted,
  io.expires_at,
  io.deleted_at,
  io.discovered_at,
  io.updated_at
from investment_opportunities io
where io.deleted_at is null
  and (io.expires_at is null or io.expires_at > now())
  and io.action_state not in ('invalidated', 'expired');
