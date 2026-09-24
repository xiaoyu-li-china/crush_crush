import type {
  IPlayerCloudSave,
  InviteClaimResult,
  PlayerCloudSnapshot,
} from '../ports/IPlayerCloudSave';
import { parseInviteCloudSlice } from '../../logic/economy/InviteLoop';
import cloudJson from '../../config/cloud.json';

const COLLECTION = cloudJson.collection || 'player_saves';

function cloudApi(): WxCloud | null {
  try {
    if (typeof wx === 'undefined' || !wx.cloud) {
      return null;
    }
    return wx.cloud;
  } catch {
    return null;
  }
}

/**
 * 微信云开发存档：文档自动带 _openid，同一微信号换设备也能拉回。
 * 控制台开通云开发后即可用；envId 空则走当前环境。
 */
export class WxCloudSaveAdapter implements IPlayerCloudSave {
  private ready: Promise<boolean> | null = null;
  private docId: string | null = null;

  public isEnabled(): boolean {
    return cloudJson.enabled !== false && !!cloudApi();
  }

  public async pull(): Promise<PlayerCloudSnapshot | null> {
    if (!(await this.ensureReady())) {
      throw new Error('cloud not ready');
    }
    const cloud = cloudApi();
    if (!cloud) {
      throw new Error('cloud api missing');
    }
    const res = await cloud.database().collection(COLLECTION).limit(1).get();
    const row = res.data[0];
    if (!row) {
      return null;
    }
    this.docId = String(row._id);
    return snapshotFromDoc(row);
  }

  public async push(snapshot: PlayerCloudSnapshot): Promise<void> {
    if (!(await this.ensureReady())) {
      return;
    }
    const cloud = cloudApi();
    if (!cloud) {
      return;
    }
    const invite = parseInviteCloudSlice(snapshot.invite);
    const payload = {
      updatedAt: snapshot.updatedAt,
      progress: snapshot.progress,
      boosters: snapshot.boosters,
      settings: snapshot.settings,
      daily: snapshot.daily,
      invite,
    };
    try {
      const db = cloud.database();
      const col = db.collection(COLLECTION);
      if (this.docId) {
        await this.writeExisting(col, db, this.docId, payload);
        return;
      }
      const existing = await col.limit(1).get();
      const row = existing.data[0];
      if (row) {
        this.docId = String(row._id);
        await this.writeExisting(col, db, this.docId, payload);
        return;
      }
      const added = await col.add({ data: payload });
      this.docId = String(added._id);
    } catch {
      // 云失败不影响本地游玩
    }
  }

  public async claimInvite(inviterCode: string): Promise<InviteClaimResult> {
    if (!(await this.ensureReady())) {
      return { ok: false, retry: true };
    }
    const cloud = cloudApi();
    if (!cloud || typeof cloud.callFunction !== 'function') {
      return { ok: false, retry: true };
    }
    try {
      const res = await cloud.callFunction({
        name: 'claimInvite',
        data: { inviterCode },
      });
      const result = (res.result ?? {}) as {
        ok?: boolean;
        retry?: boolean;
      };
      return {
        ok: result.ok === true,
        retry: result.retry === true,
      };
    } catch {
      return { ok: false, retry: true };
    }
  }

  private ensureReady(): Promise<boolean> {
    if (this.ready) {
      return this.ready;
    }
    this.ready = (async () => {
      if (!this.isEnabled()) {
        return false;
      }
      const cloud = cloudApi();
      if (!cloud) {
        return false;
      }
      try {
        const env = cloudJson.envId || cloud.DYNAMIC_CURRENT_ENV;
        cloud.init(env ? { env, traceUser: true } : { traceUser: true });
        console.info('[crush-crush][cloud] init', env || 'default');
        return true;
      } catch {
        return false;
      }
    })();
    return this.ready;
  }

  private async writeExisting(
    col: WxCloudCollection,
    db: WxCloudDatabase,
    docId: string,
    payload: {
      updatedAt: number;
      progress: PlayerCloudSnapshot['progress'];
      boosters: PlayerCloudSnapshot['boosters'];
      settings: PlayerCloudSnapshot['settings'];
      daily: PlayerCloudSnapshot['daily'];
      invite: PlayerCloudSnapshot['invite'];
    },
  ): Promise<void> {
    const invite = parseInviteCloudSlice(payload.invite);
    const command = db.command;
    if (command && typeof col.doc(docId).update === 'function') {
      await col.doc(docId).update({
        data: {
          updatedAt: payload.updatedAt,
          progress: payload.progress,
          boosters: payload.boosters,
          settings: payload.settings,
          daily: payload.daily,
          'invite.code': invite.code,
          'invite.claimedAsInvitee': invite.claimedAsInvitee,
          'invite.pendingInviter': invite.pendingInviter,
          'invite.inviteeGiftGranted': invite.inviteeGiftGranted,
          'invite.cloudClaimed': invite.cloudClaimed,
          'invite.creditHammer': command.max
            ? command.max(invite.creditHammer)
            : invite.creditHammer,
        },
      });
      return;
    }
    await col.doc(docId).set({ data: payload });
  }
}

function snapshotFromDoc(row: Record<string, unknown>): PlayerCloudSnapshot | null {
  const progress = row.progress;
  const boosters = row.boosters;
  if (!progress || typeof progress !== 'object' || !boosters || typeof boosters !== 'object') {
    return null;
  }
  const settings = row.settings;
  const daily = row.daily;
  return {
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
    progress: progress as PlayerCloudSnapshot['progress'],
    boosters: boosters as PlayerCloudSnapshot['boosters'],
    settings:
      settings && typeof settings === 'object'
        ? (settings as PlayerCloudSnapshot['settings'])
        : { muted: false },
    daily:
      daily && typeof daily === 'object'
        ? (daily as PlayerCloudSnapshot['daily'])
        : {
            ymd: '',
            bonusHammer: 0,
            clearsToday: 0,
            adHammer: 0,
            adShuffle: 0,
            adExtra: 0,
            shareFriendHammer: false,
            shareFriendShuffle: false,
            shareFriendExtra: false,
            shareGroupHammer: false,
            shareGroupShuffle: false,
            shareGroupExtra: false,
            playShuffleGranted: false,
            playExtraGranted: false,
          },
    invite: parseInviteCloudSlice(row.invite),
  };
}
