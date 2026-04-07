export default function ScoreShape({ gross, par }: { gross: number; par: number }) {
  const diff = gross - par
  const f = "font-[family-name:var(--font-crimson)] leading-none"

  if (diff <= -2) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#C9A84C]">
        <span className={`${f} text-lg font-semibold text-[#1a0a00]`}>{gross}</span>
      </span>
    )
  }
  if (diff === -1) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-[#2d6a4f]">
        <span className={`${f} text-lg text-[#1a5235]`}>{gross}</span>
      </span>
    )
  }
  if (diff === 0) {
    return <span className={`${f} text-lg text-gray-700`}>{gross}</span>
  }
  if (diff === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 border border-gray-400">
        <span className={`${f} text-base text-gray-500`}>{gross}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-300">
      <span className={`${f} text-base text-gray-600`}>{gross}</span>
    </span>
  )
}
