-- Ticker stance rollup
--
-- investment_opportunities is keyed on id, not ticker, so several sources pushing
-- the same asset create several rows. Migration 004 added merge helpers, but they
-- are advisory: nothing stops duplicates, and the live payload measured 352 rows
-- across 242 symbols.
--
-- Collapsing those rows would destroy the disagreement we actually want to see, so
-- this is a read model instead. The underlying rows stay exactly as exported —
-- every contrarian thesis survives — and this view reports, per ticker: how many
-- views exist, how they split bull vs bear, whether they disagree, and the
-- score-weighted net stance.
--
-- Weighting: each view counts for its total_score, uplifted 25% per additional
-- confirming source, so a 13F-plus-Patreon-plus-Discord long outweighs a lone
-- low-score short. net_stance is the signed weighted balance normalised to
-- -100..100, where +100 is unanimously long and -100 unanimously short.

create or replace view public_ticker_stance_rollup
with (security_invoker = true) as
with scoped as (
  select
    upper(coalesce(io.normalized_symbol, io.symbol))        as ticker,
    io.id,
    lower(coalesce(io.direction, ''))                       as dir,
    io.total_score,
    io.action_state,
    io.updated_at,
    io.source,
    io.sources,
    io.confirmed_by_count,
    io.evidence_freshness_status,
    io.evidence_review_priority_score,
    io.is_tracked,
    io.is_watchlisted,
    -- An unscored view still carries an opinion; treat it as mid-conviction rather
    -- than letting it vanish from the balance.
    coalesce(io.total_score, 50)::numeric
      * (1 + 0.25 * greatest(coalesce(io.confirmed_by_count, 1) - 1, 0)) as stance_weight,
    -- Lifecycle order, so the ticker surfaces in its most advanced state.
    case lower(io.action_state)
      when 'ready'          then 1
      when 'wait_for_entry' then 2
      when 'chasing_risk'   then 3
      when 'holding'        then 4
      when 'exit_trim'      then 5
      when 'exiting'        then 6
      when 'research'       then 7
      when 'invalidated'    then 8
      else 9
    end                                                     as state_priority,
    case coalesce(io.evidence_freshness_status, 'missing')
      when 'fresh'   then 1
      when 'aging'   then 2
      when 'stale'   then 3
      else 4
    end                                                     as freshness_rank
  from investment_opportunities io
  where io.deleted_at is null
    and (io.is_tracked or io.is_watchlisted or io.expires_at is null or io.expires_at > now())
    and coalesce(io.normalized_symbol, io.symbol) is not null
),
source_rollup as (
  -- 004 backfilled `sources` from the scalar `source`, but a row written before that
  -- can still arrive with an empty array. Fall back to `source` so a single-source
  -- view is never reported as having none.
  select s.ticker, array_agg(distinct src order by src) as distinct_sources
  from scoped s,
       unnest(
         case
           when coalesce(array_length(s.sources, 1), 0) = 0
             then array_remove(array[s.source], null)
           else s.sources
         end
       ) as src
  group by s.ticker
),
aggregated as (
  select
    s.ticker,
    count(*)::int                                                       as setup_count,
    count(*) filter (where s.dir = 'long')::int                         as bull_count,
    count(*) filter (where s.dir = 'short')::int                        as bear_count,
    count(*) filter (where s.dir not in ('long', 'short'))::int         as undirected_count,
    (
      count(*) filter (where s.dir = 'long') > 0
      and count(*) filter (where s.dir = 'short') > 0
    )                                                                   as has_disagreement,
    case
      when coalesce(sum(s.stance_weight) filter (where s.dir in ('long', 'short')), 0) > 0
      then round(
        100 * sum(
          case s.dir
            when 'long'  then s.stance_weight
            when 'short' then -s.stance_weight
            else 0
          end
        ) / sum(s.stance_weight) filter (where s.dir in ('long', 'short'))
      )::int
    end                                                                 as net_stance,
    max(s.total_score)                                                  as top_score,
    round(avg(s.total_score))::int                                      as avg_score,
    max(coalesce(s.confirmed_by_count, 1))::int                         as max_confirmed_by_count,
    max(s.evidence_review_priority_score)::int                          as max_review_priority_score,
    bool_or(coalesce(s.is_tracked, false))                              as any_tracked,
    bool_or(coalesce(s.is_watchlisted, false))                          as any_watchlisted,
    max(s.updated_at)                                                   as last_updated_at,
    -- Tiebreaks run all the way down to id so the primary is stable across queries
    -- and matches compareRows in lib/ticker-aggregate.ts.
    (array_agg(s.id order by
      s.state_priority, s.total_score desc nulls last,
      coalesce(s.confirmed_by_count, 0) desc, s.id))[1]                 as primary_id,
    (array_agg(s.action_state order by
      s.state_priority, s.total_score desc nulls last,
      coalesce(s.confirmed_by_count, 0) desc, s.id))[1]                 as primary_action_state,
    (array_agg(coalesce(s.evidence_freshness_status, 'missing')
      order by s.freshness_rank desc, s.id))[1]                         as worst_evidence_freshness
  from scoped s
  group by s.ticker
)
select
  a.ticker,
  a.setup_count,
  a.bull_count,
  a.bear_count,
  a.undirected_count,
  a.has_disagreement,
  a.net_stance,
  case
    when a.net_stance is null then null::text
    when a.net_stance >=  60  then 'strong_long'
    when a.net_stance >=  20  then 'long'
    when a.net_stance >  -20  then 'contested'
    when a.net_stance >  -60  then 'short'
    else 'strong_short'
  end                                    as stance_label,
  a.top_score,
  a.avg_score,
  a.max_confirmed_by_count,
  a.max_review_priority_score,
  a.any_tracked,
  a.any_watchlisted,
  a.last_updated_at,
  a.primary_id,
  a.primary_action_state,
  a.worst_evidence_freshness,
  coalesce(sr.distinct_sources, '{}'::text[]) as distinct_sources
from aggregated a
left join source_rollup sr on sr.ticker = a.ticker
order by
  a.has_disagreement desc,
  a.top_score desc nulls last,
  a.setup_count desc;

-- This is a public read model, not a writable API surface.
revoke all privileges on public.public_ticker_stance_rollup from anon, authenticated;
grant select on public.public_ticker_stance_rollup to anon, authenticated;
