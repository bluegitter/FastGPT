import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限校验，获取当前用户ID
    const { userId } = await authCert({ req, authToken: true });

    const { teamId } = req.body;

    if (!teamId) {
      return jsonRes(res, { code: 400, error: 'teamId is required' });
    }

    // 校验该用户是否属于该团队
    // const member = await MongoTeamMember.findOne({ userId, teamId });
    // if (!member) {
    //   return jsonRes(res, { code: 403, error: '你没有加入该团队' });
    // }

    // 这里只做校验，不做数据库写入
    // 可以在响应中返回 teamId，前端可据此切换上下文
    jsonRes(res, {
      data: { teamId },
      message: '团队切换成功'
    });
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}
