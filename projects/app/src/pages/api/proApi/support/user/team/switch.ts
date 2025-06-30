import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { createJWT, setCookie } from '@fastgpt/service/support/permission/controller';
import { getUserDetail } from '@fastgpt/service/support/user/controller';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { TeamPermission } from '@fastgpt/global/support/permission/user/controller';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限校验，获取当前用户ID
    const { tmbId, userId } = await authCert({ req, authToken: true });
    const { teamId } = req.body;

    if (!teamId) {
      return jsonRes(res, { code: 400, error: 'teamId is required' });
    }

    // 获取用户基本信息（用于判断是否为 root 用户）
    const user = await MongoUser.findById(userId);
    if (!user) {
      return jsonRes(res, { code: 404, error: '用户不存在' });
    }

    const username = user.username || '';
    const isRoot = username === 'root';

    let userDetail;

    if (isRoot) {
      // root 用户可以切换到所有团队，不需要验证团队成员身份
      // 直接获取团队信息
      const team = await MongoTeam.findById(teamId);
      if (!team) {
        return jsonRes(res, { code: 404, error: '团队不存在' });
      }

      // 为 root 用户创建特殊的用户详情对象
      userDetail = {
        _id: user._id,
        username: user.username,
        avatar: '/icon/human.svg', // root 用户默认头像
        timezone: user.timezone,
        promotionRate: user.promotionRate,
        team: {
          userId: String(user._id),
          teamId: String(team._id),
          teamAvatar: team.avatar,
          teamName: team.name,
          memberName: 'Root',
          avatar: '/icon/human.svg',
          balance: team.balance,
          tmbId: tmbId, // 特殊的 root tmbId
          teamDomain: team.teamDomain,
          role: 'owner',
          status: 'active',
          permission: new TeamPermission({ isOwner: true }),
          notificationAccount: team.notificationAccount,
          lafAccount: team.lafAccount,
          openaiAccount: team.openaiAccount,
          externalWorkflowVariables: team.externalWorkflowVariables
        },
        notificationAccount: team.notificationAccount,
        permission: new TeamPermission({ isOwner: true }),
        contact: user.contact
      };
    } else {
      // 普通用户需要验证是否属于该团队
      const member = await MongoTeamMember.findOne({
        userId,
        teamId,
        status: { $in: ['active'] } // 只查询活跃状态的成员
      });
      if (!member) {
        return jsonRes(res, { code: 403, error: '你没有加入该团队或团队成员状态异常' });
      }

      // 获取用户详细信息
      userDetail = await getUserDetail({
        tmbId: member._id,
        userId: userId
      });

      // 验证 userDetail.team 是否包含必要的字段
      if (!userDetail.team?.teamId || !userDetail.team?.tmbId) {
        return jsonRes(res, {
          code: 500,
          error: '获取用户团队信息失败，缺少必要的团队信息'
        });
      }
    }

    const token = createJWT({
      _id: userDetail._id,
      team: {
        teamId: userDetail.team.teamId,
        tmbId: userDetail.team.tmbId
      },
      isRoot: isRoot
    });

    setCookie(res, token);

    jsonRes(res, {
      data: {
        teamId: userDetail.team.teamId,
        tmbId: userDetail.team.tmbId
      },
      message: '团队切换成功'
    });
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}
