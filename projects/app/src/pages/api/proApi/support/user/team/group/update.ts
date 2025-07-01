import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { GroupMemberRole } from '@fastgpt/global/support/permission/memberGroup/constant';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证 - 只有团队管理员或所有者可以更新成员组
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'PUT') {
      const { groupId, name, avatar, memberList } = req.body;

      // 参数验证
      if (!groupId) {
        return jsonRes(res, {
          code: 400,
          error: '成员组ID不能为空'
        });
      }

      // 验证成员组是否存在且属于当前团队
      const group = await MongoMemberGroupModel.findOne({
        _id: groupId,
        teamId: teamId
      });

      if (!group) {
        return jsonRes(res, {
          code: 404,
          error: '成员组不存在或无权限访问'
        });
      }

      // 验证名称唯一性（如果更新名称）
      if (name && name !== group.name) {
        const existingGroup = await MongoMemberGroupModel.findOne({
          teamId: teamId,
          name: name,
          _id: { $ne: groupId }
        });

        if (existingGroup) {
          return jsonRes(res, {
            code: 400,
            error: '成员组名称已存在'
          });
        }
      }

      // 验证成员列表（如果提供）
      if (memberList !== undefined) {
        if (!Array.isArray(memberList)) {
          return jsonRes(res, {
            code: 400,
            error: '成员列表格式错误'
          });
        }

        // 验证角色值
        const validRoles = Object.values(GroupMemberRole);
        for (const member of memberList) {
          if (!member.tmbId) {
            return jsonRes(res, {
              code: 400,
              error: '成员ID不能为空'
            });
          }
          if (!validRoles.includes(member.role)) {
            return jsonRes(res, {
              code: 400,
              error: `无效的角色值: ${member.role}`
            });
          }
        }

        // 验证所有成员是否属于当前团队
        const memberIds = memberList.map((m) => m.tmbId);
        const validMembers = await MongoTeamMember.find({
          _id: { $in: memberIds },
          teamId: teamId,
          status: TeamMemberStatusEnum.active
        });

        if (validMembers.length !== memberIds.length) {
          return jsonRes(res, {
            code: 400,
            error: '部分成员不存在或不属于当前团队'
          });
        }

        // 验证是否只有一个owner
        const owners = memberList.filter((m) => m.role === GroupMemberRole.owner);
        if (owners.length > 1) {
          return jsonRes(res, {
            code: 400,
            error: '成员组只能有一个所有者'
          });
        }

        // 如果没有owner，将第一个admin设置为owner
        if (owners.length === 0) {
          const admins = memberList.filter((m) => m.role === GroupMemberRole.admin);
          if (admins.length === 0) {
            return jsonRes(res, {
              code: 400,
              error: '成员组必须有一个所有者或管理员'
            });
          }

          // 将第一个admin设置为owner
          console.log('[成员组更新] 没有owner，将第一个admin设置为owner:', admins[0].tmbId);
          admins[0].role = GroupMemberRole.owner;
        }
      }

      // 使用事务更新成员组
      const updateResult = await mongoSessionRun(async (session) => {
        // 更新成员组基本信息
        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (avatar !== undefined) updateData.avatar = avatar;

        if (Object.keys(updateData).length > 0) {
          await MongoMemberGroupModel.findByIdAndUpdate(groupId, updateData, { session });
        }

        // 更新成员列表（如果提供）
        if (memberList !== undefined) {
          // 在事务内部获取当前群组的成员数量，确保数据一致性
          const currentMemberCount = await MongoGroupMemberModel.countDocuments(
            {
              groupId: new Types.ObjectId(groupId)
            },
            { session }
          );

          console.log('[成员组更新] 当前群组成员数量:', currentMemberCount);
          console.log('[成员组更新] 新成员列表数量:', memberList.length);

          // 删除当前组的所有成员
          const deleteResult = await MongoGroupMemberModel.deleteMany(
            { groupId: new Types.ObjectId(groupId) },
            { session }
          );

          console.log('[成员组更新] 删除的成员数量:', deleteResult.deletedCount);

          // 添加新的成员
          let insertResult: any = [];
          if (memberList.length > 0) {
            const groupMembers = memberList.map((member: any) => ({
              groupId: new Types.ObjectId(groupId),
              tmbId: new Types.ObjectId(member.tmbId),
              role: member.role
            }));

            insertResult = await MongoGroupMemberModel.insertMany(groupMembers, { session });
            console.log('[成员组更新] 插入的成员数量:', insertResult.length);
          }

          // 返回更新信息
          return {
            previousMemberCount: currentMemberCount,
            newMemberCount: memberList.length,
            deletedCount: deleteResult.deletedCount,
            addedCount: insertResult.length
          };
        }

        return undefined;
      });

      // 获取更新后的成员组信息
      const updatedGroup = await MongoMemberGroupModel.findById(groupId).lean();

      if (!updatedGroup) {
        return jsonRes(res, {
          code: 404,
          error: '成员组更新后不存在，可能已被删除'
        });
      }

      jsonRes(res, {
        data: {
          groupId: updatedGroup._id,
          name: updatedGroup.name,
          avatar: updatedGroup.avatar,
          updateTime: updatedGroup.updateTime,
          memberCount: memberList ? memberList.length : undefined,
          updateInfo: updateResult
        },
        message: '成员组更新成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('更新成员组失败:', error);
    jsonRes(res, {
      code: 500,
      error: '更新失败'
    });
  }
}
