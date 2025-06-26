import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限校验，获取当前团队ID
    const { teamId } = await authCert({ req, authToken: true });

    // 统计该团队成员数量
    const count = await MongoTeamMember.countDocuments({ teamId });

    jsonRes(res, {
      data: { count }
    });
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}
