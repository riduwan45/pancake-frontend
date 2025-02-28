import { Protocol, fetchAllUniversalFarms } from '@pancakeswap/farms'
import { LegacyRouter } from '@pancakeswap/smart-router/legacy-router'
import { Token } from '@pancakeswap/swap-sdk-core'
import { getTokenByAddress } from '@pancakeswap/tokens'
import BN from 'bignumber.js'
import { paths } from 'state/info/api/schema'
import { safeGetAddress } from 'utils'
import { Address } from 'viem'
import { PoolInfo } from './type'

export const parseFarmPools = async (
  data:
    | paths['/cached/pools/farming']['get']['responses']['200']['content']['application/json']
    | paths['/cached/pools/list']['get']['responses']['200']['content']['application/json']['rows']
    | paths['/cached/pools/{chainName}/{id}']['get']['responses']['200']['content']['application/json'][],
  options: { isFarming?: boolean } = {},
): Promise<PoolInfo[]> => {
  const fetchFarmConfig = await fetchAllUniversalFarms()

  const result = await Promise.all(
    data.map(async (pool) => {
      let stableSwapAddress: Address | undefined
      let lpAddress = safeGetAddress(pool.id)!
      let feeTier = Number(pool.feeTier ?? 2500)
      if (pool.protocol === 'stable') {
        const pairs = await LegacyRouter.getStableSwapPairs(pool.chainId)
        const stableConfig = pairs?.find((pair) => {
          return safeGetAddress(pair.stableSwapAddress) === safeGetAddress(pool.id as Address)
        })
        if (stableConfig) {
          stableSwapAddress = safeGetAddress(stableConfig.stableSwapAddress)
          lpAddress = safeGetAddress(stableConfig.lpAddress)!
          feeTier = stableConfig.stableTotalFee * 1000000
        }
      }
      const localFarm = fetchFarmConfig.find(
        (farm) => safeGetAddress(farm.lpAddress) === safeGetAddress(lpAddress) && farm.chainId === pool.chainId,
      )
      let pid: number | undefined
      if (localFarm) {
        // eslint-disable-next-line prefer-destructuring
        pid = Number(localFarm.pid) ?? undefined
      }
      const token0Address = safeGetAddress(pool.token0.id)!
      const token0 =
        getTokenByAddress(pool.chainId, token0Address) ??
        new Token(pool.chainId, token0Address, pool.token0.decimals, pool.token0.symbol, pool.token0.name)
      const token1Address = safeGetAddress(pool.token1.id)!
      const token1 =
        getTokenByAddress(pool.chainId, token1Address) ??
        new Token(pool.chainId, token1Address, pool.token1.decimals, pool.token1.symbol, pool.token1.name)
      return {
        chainId: pool.chainId,
        pid,
        lpAddress,
        stableSwapAddress,
        protocol: pool.protocol as Protocol,
        token0,
        token1,
        token0Price: (pool.token0Price as `${number}`) ?? '0',
        token1Price: (pool.token1Price as `${number}`) ?? '0',
        tvlToken0: (pool.tvlToken0 as `${number}`) ?? '0',
        tvlToken1: (pool.tvlToken1 as `${number}`) ?? '0',
        lpApr: pool.apr24h as `${number}`,
        tvlUsd: pool.tvlUSD as `${number}`,
        tvlUsd24h: pool.tvlUSD24h as `${number}`,
        vol24hUsd: pool.volumeUSD24h as `${number}`,
        vol48hUsd: pool.volumeUSD48h as `${number}`,
        vol7dUsd: pool.volumeUSD7d as `${number}`,
        totalFeeUSD: pool.totalFeeUSD as `${number}`,
        fee24hUsd: pool.feeUSD24h as `${number}`,
        liquidity: pool.liquidity,
        feeTier,
        feeTierBase: 1_000_000,
        isFarming: !!options?.isFarming,
      } satisfies PoolInfo
    }),
  )

  return result
}

export const getPoolMultiplier = (allocPoint: bigint) => {
  if (typeof allocPoint === 'undefined') {
    return `0X`
  }
  return `${+new BN(allocPoint.toString()).div(10).toString()}X`
}
