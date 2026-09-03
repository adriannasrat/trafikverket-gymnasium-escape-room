export const barlow = "[font-family:'Barlow_Condensed',sans-serif]"

export const focusRing =
  'focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[rgba(215,0,0,0.25)]'

export const eyebrow =
  'mb-[13px] flex items-center gap-2 text-[10px] font-extrabold tracking-[0.18em] text-[#d70000]'

export const primaryButton =
  `inline-flex min-h-12 cursor-pointer items-center justify-center gap-[11px] border-0 bg-[#d70000] px-[22px] text-[12px] font-extrabold uppercase tracking-[0.09em] text-white transition-[transform,background] duration-[180ms] ease-in-out not-disabled:hover:-translate-y-px not-disabled:hover:bg-[#5f0000] disabled:cursor-not-allowed disabled:opacity-[0.46] ${focusRing}`

export const secondaryButton =
  `inline-flex min-h-12 cursor-pointer items-center justify-center gap-[9px] border border-[#777] bg-white px-[22px] text-[12px] font-bold uppercase tracking-[0.08em] text-[#202020] ${focusRing}`

export const fieldLabel =
  'grid gap-2 text-[10px] font-extrabold tracking-[0.12em] text-[#4a4a4a]'

export const field =
  `w-full rounded-none border border-[#bdbdbd] bg-white px-[14px] py-[13px] text-[#202020] outline-none focus:border-[#d70000] focus:shadow-[0_0_0_3px_rgba(215,0,0,0.08)] ${focusRing}`

export const formError =
  'm-0 border-l-[3px] border-[#c7352d] bg-[#fff0ef] px-3 py-[10px] text-[12px] text-[#9b2520]'

export const backLink =
  `inline-flex items-center gap-[7px] text-[12px] text-[#555] ${focusRing}`

export const eventFooter =
  'flex min-h-[54px] items-center justify-between border-t border-[#e5e5e5] bg-white px-[clamp(24px,4vw,68px)] text-[9px] tracking-[0.16em] text-[#717171] max-[720px]:px-[18px]'

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}
