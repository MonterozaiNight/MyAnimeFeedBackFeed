import { AppContext } from '../config'
import { OutputSchema } from "../lexicon/types/app/bsky/feed/getFeedSkeleton"
import { SkeletonFeedPost } from "../lexicon/types/app/bsky/feed/defs"
import { AtpAgent } from "@atproto/api"
import type { Record } from '@atproto/api/dist/client/types/app/bsky/feed/post'

export const shortname = 'whats-alf'

export const handler = async (ctx: AppContext) => {
    console.log('--- Custom Feed Handler (my-posts) Called ---');

    const agent = new AtpAgent({
        service: "https://bsky.social"
    });

    await agent.login({
        identifier: process.env.FEEDGEN_PUBLISHER_IDENTIFIER || '',
        password: process.env.FEEDGEN_APP_PASSWORD || ''
    })

    try {
        
        const authorFeedRes = await agent.api.app.bsky.feed.getAuthorFeed({
            actor: ctx.cfg.publisherDid,
            limit: 50
        });

        const posts = authorFeedRes.data.feed;

        const TARGET_TEXT = '#忍野にゃんこの25秋アニメ感想';
        const filteredPosts = posts.filter((item: any) => {
            const isNotRepost = !item.reason;

            const postText = item.post.record?.text;

            const containsTargetText = postText && postText.includes(TARGET_TEXT);

            return isNotRepost && containsTargetText;
        });

        const feedItems: SkeletonFeedPost[] = filteredPosts.map((item: any) => {
            return {
                post: item.post.uri
            }
        });

        let nextCursor: string | undefined = authorFeedRes.data.cursor;
        console.log('Generated Next Cursor:', nextCursor);

        // 4. OutputSchema の形式で結果を返す
        const result: OutputSchema = {
            feed: feedItems,
            cursor: nextCursor,
        };

        console.log('--- Custom Feed Handler Finished ---');
        return result;

    } catch (error) {
        console.error('Error in feed-generation handler:', error);
        return { feed: [] };
    }
}