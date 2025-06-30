import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUsage } from '@fastgpt/service/support/wallet/usage/schema';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限校验，获取当前用户和团队ID
    const { userId, teamId, tmbId } = await authCert({ req, authToken: true });

    // 查询团队信息
    const team = await MongoTeam.findById(teamId).lean();
    if (!team) {
      return jsonRes(res, { code: 404, error: '团队不存在' });
    }

    // 查询团队用量信息（假设有 MongoUsage 表，按 teamId 统计）
    const usage = await MongoUsage.findOne({ teamId }).lean();

    // 查询团队成员信息
    const member = await MongoTeamMember.findById(tmbId).lean();

    // 查询用户信息
    const user = await MongoUser.findById(userId).lean();

    jsonRes(res, {
      data: {
        list: (usage?.list || []).map((item) => ({
          ...item,
          sourceMember: item.sourceMember || { avatar: '/icon/human.svg', name: '-' }
        })),
        total: usage?.list?.length || 0,
        teamId,
        teamName: team.name,
        usage: usage || {},
        member: member ? { tmbId: member._id, name: member.name, role: member.role } : null,
        user: user ? { userId: user._id, username: user.username } : null
      }
    });
  } catch (error) {
    console.error('获取团队用量失败:', error);
    jsonRes(res, {
      code: 500,
      error: '获取用量失败'
    });
  }
}
