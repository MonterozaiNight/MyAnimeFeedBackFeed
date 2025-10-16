import AtpAgent from '@atproto/api'
import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import dotenv from "dotenv";
import { Database } from "./db";

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)
  }
}

export class MyAnimeFeedbackSubscription {
  agent: AtpAgent

  constructor(public db: Database) {
    this.agent = new AtpAgent({
      service: "https://bsky.social"
    });
  }

  async run() {
    await this.reload()
  }

  async reload() {
    let rowCount = 0;

    dotenv.config();
    await this.agent.login({
      identifier: process.env.FEEDGEN_PUBLISHER_IDENTIFIER || '',
      password: process.env.FEEDGEN_APP_PASSWORD || ''
    });

    const TARGET_TEXT = '#忍野にゃんこの25秋アニメ感想'
    const TARGET_DATE = new Date('2025-09-26T00:00:00.000Z');
    let cursor: string | undefined = undefined;
    while(true) {
      const listRecordsRes = await this.agent.api.com.atproto.repo.listRecords({
        repo: process.env.FEEDGEN_PUBLISHER_DID || '',
        collection: 'app.bsky.feed.post',
        limit: 100,
        cursor: cursor
      });

      const records = listRecordsRes.data.records;
      if (!records || records.length === 0) {
        console.log('レコードはもう見つかりません。');
        break;
      }

      let shouldContinueFetching = false;
      for(const record of records) {
        const postRecordValue = record.value as Record<string, any>;
        const postDate = new Date(postRecordValue.createdAt);

        if (postDate >= TARGET_DATE) {

          const postText = postRecordValue.text;
          if (postText && postText.includes(TARGET_TEXT)) {
            const postsToCreate = {
              uri: record.uri,
              cid: record.cid,
              indexedAt: postRecordValue.createdAt
            }

            await this.db
              .insertInto('post')
              .values(postsToCreate)
              .onConflict(oc => oc.doNothing())
              .execute()
            rowCount++
          }

          shouldContinueFetching = true;    // まだ指定日以降の投稿があるのでループ
        } else {
          shouldContinueFetching = false;   // 指定日以降の投稿がないのでループ終了
          break;
        }
      }

      cursor = listRecordsRes.data.cursor;

      // 指定日より古い投稿に達したか、カーソルがなくなった場合は終了
      if (!shouldContinueFetching || !cursor) {
        break; 
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log("[INFO] 登録データ総数は" + rowCount + "件です。");
  }
}