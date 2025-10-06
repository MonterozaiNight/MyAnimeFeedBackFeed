import { AppContext } from '../config'
import { OutputSchema, QueryParams } from "../lexicon/types/app/bsky/feed/getFeedSkeleton"
import { SkeletonFeedPost } from "../lexicon/types/app/bsky/feed/defs"
import type { Record } from '@atproto/api/dist/client/types/app/bsky/feed/post'
import { InvalidRequestError } from '@atproto/xrpc-server'

export const shortname = 'whats-alf'

export const handler = async (ctx: AppContext, params: QueryParams) => {
    console.log('--- Custom Feed Handler (my-25AutumnAnime-posts) Called ---');

    let builder = ctx.db
        .selectFrom('post')
        .selectAll()
        .orderBy('indexedAt', 'desc')
        .orderBy('cid', 'desc')
        .limit(params.limit)

    if (params.cursor) {
        const [indexedAt, cid] = params.cursor.split('::')
        if (!indexedAt || !cid) {
            throw new InvalidRequestError('malformed cursor')
        }
        const timeStr = new Date(parseInt(indexedAt, 10)).toISOString()
        builder = builder
            .where('post.indexedAt', '<', timeStr)
            .orWhere((qb) => qb.where('post.indexedAt', '=', timeStr))
            .where('post.cid', '<', cid)
    }
    const res = await builder.execute();

    const feed = res.map((row) => ({
        post: row.uri,
    }))

    let cursor: string | undefined
    const last = res.at(-1)
    if (last) {
        cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
    }

    console.log('--- Custom Feed Handler Finished ---');
    return {
        cursor,
        feed
    }
}