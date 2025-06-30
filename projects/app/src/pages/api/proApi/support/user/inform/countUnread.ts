import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'GET') {
      // 这里需要根据你的通知数据结构来实现
      // 假设你有一个通知集合，需要统计未读数量

      // 示例：统计未读通知数量
      const unreadCount = 0; // 这里应该查询数据库获取实际数量

      // 示例：统计未读邀请数量
      const unreadInvitations = 0; // 这里应该查询数据库获取实际数量

      jsonRes(res, {
        data: {
          total: unreadCount + unreadInvitations,
          notifications: unreadCount,
          invitations: unreadInvitations
        }
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}
