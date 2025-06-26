import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';
import { customNanoid } from '@fastgpt/global/common/string/tools';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'POST') {
      // 检查是否有管理权限
      const member = await MongoTeamMember.findOne({ _id: tmbId, teamId });
      if (!member || member.role !== TeamMemberRoleEnum.owner) {
        return jsonRes(res, {
          code: 403,
          error: 'No permission'
        });
      }

      const { maxUses = 10, expireDays = 7 } = req.body;

      // 生成邀请链接ID
      const invitationId = customNanoid(
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        16
      );

      // 计算过期时间
      const expireTime = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);

      // 创建邀请链接
      const invitationLink = {
        id: invitationId,
        teamId,
        link: `${process.env.FE_DOMAIN || 'http://localhost:3000'}/invite/${invitationId}`,
        status: 'active',
        createTime: new Date(),
        expireTime,
        maxUses,
        usedCount: 0,
        createdBy: tmbId
      };

      // 这里应该保存到数据库
      // await MongoInvitationLink.create(invitationLink);

      jsonRes(res, {
        data: invitationLink
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
