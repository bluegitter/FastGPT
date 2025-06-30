import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import {
  TeamMemberStatusEnum,
  TeamMemberRoleEnum
} from '@fastgpt/global/support/user/team/constant';
import { TeamErrEnum } from '@fastgpt/global/common/error/code/team';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { getTmbInfoByTmbId } from '@fastgpt/service/support/user/team/controller';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证 - 只有团队管理员或所有者可以恢复成员
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'POST') {
      const { tmbId } = req.body;

      // 参数验证
      if (!tmbId) {
        return jsonRes(res, {
          code: 400,
          error: '团队成员ID不能为空'
        });
      }

      // 验证当前用户是否有管理权限
      const currentMemberInfo = await getTmbInfoByTmbId({ tmbId: tmbId });

      if (!currentMemberInfo) {
        return jsonRes(res, {
          code: 403,
          error: '您不是该团队的活跃成员'
        });
      }

      // 检查是否有管理权限（所有者或管理员）
      if (!currentMemberInfo.permission.hasManagePer) {
        return jsonRes(res, {
          code: 403,
          error: '您没有权限恢复团队成员'
        });
      }

      // 查找要恢复的团队成员
      const targetMember = await MongoTeamMember.findOne({
        _id: tmbId,
        teamId
      });

      if (!targetMember) {
        return jsonRes(res, {
          code: 404,
          error: '团队成员不存在'
        });
      }

      // 检查成员状态
      if (targetMember.status === TeamMemberStatusEnum.active) {
        return jsonRes(res, {
          code: 400,
          error: '该成员已经是活跃状态'
        });
      }

      // 使用事务确保数据一致性
      await mongoSessionRun(async (session) => {
        // 恢复团队成员状态
        await MongoTeamMember.findByIdAndUpdate(
          tmbId,
          {
            status: TeamMemberStatusEnum.active,
            updateTime: new Date()
          },
          { session }
        );

        // 更新团队成员数量（如果需要）
        const activeMemberCount = await MongoTeamMember.countDocuments({
          teamId,
          status: TeamMemberStatusEnum.active
        });

        await MongoTeam.findByIdAndUpdate(
          teamId,
          {
            memberCount: activeMemberCount,
            updateTime: new Date()
          },
          { session }
        );
      });

      // 获取恢复后的成员信息
      const restoredMember = await MongoTeamMember.findById(tmbId).lean();

      if (!restoredMember) {
        return jsonRes(res, {
          code: 500,
          error: '恢复成员后无法获取成员信息'
        });
      }

      jsonRes(res, {
        data: {
          tmbId: restoredMember._id,
          userId: restoredMember.userId,
          name: restoredMember.name,
          role: restoredMember.role,
          status: restoredMember.status,
          teamId: restoredMember.teamId,
          createTime: restoredMember.createTime,
          updateTime: restoredMember.updateTime
        },
        message: '团队成员恢复成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('恢复团队成员失败:', error);
    jsonRes(res, {
      code: 500,
      error: error instanceof Error ? error.message : '恢复团队成员失败'
    });
  }
}
