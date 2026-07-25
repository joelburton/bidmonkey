import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useFlags } from './useFlags'
import { clearFlag, fetchFlags, setFlag } from './data/flags'

vi.mock('./data/flags', () => ({
  fetchFlags: vi.fn(),
  setFlag: vi.fn(),
  clearFlag: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchFlags).mockResolvedValue(new Map())
  vi.mocked(setFlag).mockResolvedValue(undefined)
  vi.mocked(clearFlag).mockResolvedValue(undefined)
})

describe('useFlags', () => {
  it('loads the flags on mount', async () => {
    vi.mocked(fetchFlags).mockResolvedValue(new Map([['a', 'wrong' as const]]))
    const { result } = renderHook(() => useFlags())
    await waitFor(() => expect(result.current.flags.get('a')).toBe('wrong'))
  })

  it('toggle flags by hand, then unflags — writing each way', async () => {
    const { result } = renderHook(() => useFlags())
    await waitFor(() => expect(fetchFlags).toHaveBeenCalled())

    act(() => result.current.toggle('a'))
    expect(result.current.flags.get('a')).toBe('manual')
    expect(setFlag).toHaveBeenCalledWith('a', 'manual')

    act(() => result.current.toggle('a'))
    expect(result.current.flags.has('a')).toBe(false)
    expect(clearFlag).toHaveBeenCalledWith('a')
  })

  it('a failed write springs the flag back instead of looking saved', async () => {
    vi.mocked(setFlag).mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useFlags())
    await waitFor(() => expect(fetchFlags).toHaveBeenCalled())

    act(() => result.current.toggle('a'))
    expect(result.current.flags.get('a')).toBe('manual') // optimistic
    await waitFor(() => expect(result.current.flags.has('a')).toBe(false)) // reverted
  })

  it("a wrong answer flags; retries and 'alternate' never downgrade or re-write", async () => {
    const { result } = renderHook(() => useFlags())
    await waitFor(() => expect(fetchFlags).toHaveBeenCalled())

    act(() => result.current.flagAnswer('a', 'wrong'))
    expect(result.current.flags.get('a')).toBe('wrong')
    expect(setFlag).toHaveBeenCalledTimes(1)

    // Retrying the same wrong answer, or later picking an accepted alternative,
    // must not write again — 'wrong' is the strongest reason.
    act(() => result.current.flagAnswer('a', 'wrong'))
    act(() => result.current.flagAnswer('a', 'alternate'))
    expect(result.current.flags.get('a')).toBe('wrong')
    expect(setFlag).toHaveBeenCalledTimes(1)
  })

  it("an accepted alternative flags as 'alternate', and 'wrong' later escalates it", async () => {
    const { result } = renderHook(() => useFlags())
    await waitFor(() => expect(fetchFlags).toHaveBeenCalled())

    act(() => result.current.flagAnswer('a', 'alternate'))
    expect(result.current.flags.get('a')).toBe('alternate')

    act(() => result.current.flagAnswer('a', 'alternate')) // unchanged → no write
    expect(setFlag).toHaveBeenCalledTimes(1)

    act(() => result.current.flagAnswer('a', 'wrong'))
    expect(result.current.flags.get('a')).toBe('wrong')
    expect(setFlag).toHaveBeenLastCalledWith('a', 'wrong')
  })
})
