import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限校验，获取当前用户ID
    const { userId } = await authCert({ req, authToken: true });

    const { status } = req.query;

    // 查找该用户所有团队成员关系
    const memberQuery: any = { userId };
    if (status) {
      memberQuery.status = status;
    }

    const members = await MongoTeamMember.find(memberQuery).lean();

    // 获取团队ID列表
    const teamIds = members.map((m: any) => m.teamId);

    // 查询团队信息
    // const teams = await MongoTeam.find({ _id: { $in: teamIds } }).lean();
    const teams = await MongoTeam.find().lean();
    const formattedTeams = teams.map((team) => ({
      teamId: String(team._id), // 前端期望的字段名
      teamName: team.name, // 前端期望的字段名
      avatar: team.avatar, // 前端组件需要的字段
      ownerId: team.ownerId, // 保留其他字段（可选）
      createTime: team.createTime // 保留其他字段（可选）
    }));

    jsonRes(res, {
      data: formattedTeams
    });
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}
