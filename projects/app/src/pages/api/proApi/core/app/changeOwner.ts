import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoApp } from '@fastgpt/service/core/app/schema';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { Types } from 'mongoose';

/**
 * 更换 App 所有者
 * POST /proApi/core/app/changeOwner
 * body: { appId: string, ownerId: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }

    const { tmbId, teamId, isRoot } = await authCert({ req, authToken: true });
    const { appId, ownerId } = req.body;

    if (!appId || !ownerId) {
      return jsonRes(res, { code: 400, error: 'appId和ownerId不能为空' });
    }

    let isAdminOrOwner = false;
    if (isRoot) {
      isAdminOrOwner = true;
    } else {
      // 查询 tmbId 对应的团队成员，判断 role 是否为 owner 或 admin
      const member = await MongoTeamMember.findOne({ _id: tmbId, teamId });
      isAdminOrOwner = !!(member && ['owner', 'admin'].includes(member.role));
    }
    if (!isAdminOrOwner) {
      return jsonRes(res, { code: 403, error: '无权限操作' });
    }

    // 校验新 owner 是否为本团队有效成员
    const newOwner = await MongoTeamMember.findOne({
      _id: new Types.ObjectId(ownerId),
      teamId,
      status: 'active'
    });
    if (!newOwner) {
      return jsonRes(res, { code: 404, error: '新所有者不是本团队有效成员' });
    }

    // 校验 app 是否属于本团队
    const app = await MongoApp.findOne({
      _id: new Types.ObjectId(appId),
      teamId
    });
    if (!app) {
      return jsonRes(res, { code: 404, error: 'App不存在或不属于当前团队' });
    }

    // 事务更新 owner
    await mongoSessionRun(async (session) => {
      await MongoApp.updateOne(
        { _id: app._id },
        { $set: { owner: ownerId, updateTime: new Date() } },
        { session }
      );
    });

    jsonRes(res, {
      data: {
        appId,
        newOwner: ownerId,
        updateTime: new Date()
      },
      message: 'App所有者变更成功'
    });
  } catch (err) {
    console.error('App所有者变更失败:', err);
    jsonRes(res, { code: 500, error: 'App所有者变更失败' });
  }
}
