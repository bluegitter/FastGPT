import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum
} from '@fastgpt/global/support/user/team/constant';
import { hashStr } from '@fastgpt/global/common/string/tools';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'POST') {
      const {
        username,
        password,
        teamId: requestTeamId,
        role = TeamMemberRoleEnum.member
      } = req.body;

      // 使用请求中的 teamId 或当前用户的 teamId
      const targetTeamId = requestTeamId || teamId;

      // 查找用户
      const existUser = await MongoUser.findOne({ username });
      if (existUser) {
        return res.status(400).json({ error: 'Username already exists', user: existUser });
      }

      const hashedPassword = hashStr(password);
      const newUser = new MongoUser({
        username,
        password: hashedPassword,
        status: 'active',
        avatar: '/icon/human.svg',
        timezone: 'Asia/Shanghai'
      });

      const user = await newUser.save();

      // 创建团队成员
      const newMember = await MongoTeamMember.create({
        userId: user._id,
        teamId: targetTeamId,
        name: user.username,
        role: role,
        status: TeamMemberStatusEnum.active,
        createTime: new Date()
      });

      jsonRes(res, {
        data: newMember
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
