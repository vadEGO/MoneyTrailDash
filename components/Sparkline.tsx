interface SparklineProps {
  prices: number[]   // close prices in chronological order
  width?: number
  height?: number
}

export default function Sparkline({ prices, width = 72, height = 28 }: SparklineProps) {
  if (!prices || prices.length < 2) {
    return <div style={{ width, height }} className="bg-surface-dim rounded" />
  }

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const toX = (i: number) => (i / (prices.length - 1)) * width
  const toY = (p: number) => height - ((p - min) / range) * (height - 4) - 2

  const points = prices.map((p, i) => `${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(' ')

  const first = prices[0]
  const last = prices[prices.length - 1]
  const up = last >= first
  const color = up ? '#059669' : '#e02424'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* End dot */}
      <circle
        cx={toX(prices.length - 1)}
        cy={toY(last)}
        r="2"
        fill={color}
      />
    </svg>
  )
}
