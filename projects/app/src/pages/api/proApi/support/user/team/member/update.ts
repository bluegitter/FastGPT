import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { hashStr } from '@fastgpt/global/common/string/tools';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    await authCert({ req, authToken: true });

    if (req.method === 'PUT') {
      const { tmbId, username, password, teamId, isAdmin } = req.body;

      if (!tmbId) {
        return jsonRes(res, {
          code: 400,
          error: 'tmbId is required'
        });
      }

      // 查找要更新的成员
      const memberToUpdate = await MongoTeamMember.findById(tmbId);
      if (!memberToUpdate) {
        return jsonRes(res, {
          code: 404,
          error: 'Member not found'
        });
      }

      // 查找对应的用户
      const user = await MongoUser.findById(memberToUpdate.userId);
      if (!user) {
        return jsonRes(res, {
          code: 404,
          error: 'User not found'
        });
      }

      // 如果设置为管理员，则转让团队所有者，并将该成员role设为owner
      if (isAdmin) {
        await MongoTeam.findByIdAndUpdate(memberToUpdate.teamId, {
          ownerId: memberToUpdate.userId
        });
        await MongoTeamMember.findByIdAndUpdate(tmbId, { role: TeamMemberRoleEnum.owner });
      } else {
        // 如果当前是owner，且isAdmin为false，则降级为member
        if (memberToUpdate.role === TeamMemberRoleEnum.owner) {
          await MongoTeamMember.findByIdAndUpdate(tmbId, { role: TeamMemberRoleEnum.member });
        }
      }

      // 更新用户信息
      const userUpdateData: any = {};
      if (username && username !== user.username) {
        // 检查用户名是否已存在
        const existingUser = await MongoUser.findOne({ username });
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          return jsonRes(res, {
            code: 400,
            error: 'Username already exists'
          });
        }
        userUpdateData.username = username;
      }

      if (password) {
        userUpdateData.password = hashStr(password);
      }

      // 更新用户
      if (Object.keys(userUpdateData).length > 0) {
        await MongoUser.findByIdAndUpdate(user._id, userUpdateData);
      }

      // 更新团队成员信息
      const memberUpdateData: any = {};
      if (username && username !== memberToUpdate.name) {
        memberUpdateData.name = username;
      }

      if (teamId && teamId !== memberToUpdate.teamId.toString()) {
        // 检查是否已经是目标团队的成员
        const existingMember = await MongoTeamMember.findOne({
          userId: user._id,
          teamId: teamId
        });

        if (existingMember) {
          return jsonRes(res, {
            code: 400,
            error: 'User is already a member of the target team'
          });
        }

        // 删除原团队成员关系
        await MongoTeamMember.findByIdAndDelete(tmbId);

        // 创建新的团队成员关系
        await MongoTeamMember.create({
          userId: user._id,
          teamId: teamId,
          name: username || user.username,
          avatar: memberToUpdate.avatar || '/icon/human.svg',
          role: memberToUpdate.role,
          status: memberToUpdate.status,
          createTime: new Date()
        });
      } else if (Object.keys(memberUpdateData).length > 0) {
        // 只更新成员名称
        await MongoTeamMember.findByIdAndUpdate(tmbId, memberUpdateData);
      }

      jsonRes(res, {
        data: { success: true },
        message: 'User updated successfully'
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
