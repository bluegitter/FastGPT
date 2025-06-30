import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { PerResourceTypeEnum } from '@fastgpt/global/support/permission/constant';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { Types } from 'mongoose';

// 定义协作者更新请求的数据结构
interface CollaboratorUpdateRequest {
  members?: Array<{
    tmbId: string;
    permission?: number;
  }>;
  groups?: Array<{
    groupId: string;
    permission?: number;
  }>;
  orgs?: Array<{
    orgId: string;
    permission?: number;
  }>;
  // 兼容旧版本的简单权限设置
  permission?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证 - 只有团队管理员或所有者可以更新协作者权限
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'PUT') {
      const { members, groups, orgs, permission } = req.body;

      // 参数验证
      if (!members && !groups && !orgs) {
        return jsonRes(res, {
          code: 400,
          error: '至少需要提供一个成员、组织或成员组列表'
        });
      }

      // 验证权限值（如果提供）
      if (permission !== undefined) {
        if (typeof permission !== 'number' || permission < 0) {
          return jsonRes(res, {
            code: 400,
            error: '权限值必须是有效的数字'
          });
        }
      }

      // 处理成员列表
      let validMembers: string[] = [];
      if (members && Array.isArray(members)) {
        if (members.length > 0) {
          // 支持新格式：members 是对象数组，包含 tmbId 和 permission
          if (typeof members[0] === 'object' && members[0] !== null && 'tmbId' in members[0]) {
            const memberIds = members.map((item: any) => new Types.ObjectId(item.tmbId));
            const validMembersResult = await MongoTeamMember.find({
              _id: { $in: memberIds },
              teamId: teamId,
              status: 'active'
            });

            validMembers = validMembersResult.map((member) => member._id.toString());

            // 检查是否有无效成员
            const invalidMembers = members.filter(
              (item: any) => !validMembers.includes(item.tmbId)
            );
            if (invalidMembers.length > 0) {
              console.log(
                `[团队协作者更新] 忽略无效成员: ${invalidMembers.map((m: any) => m.tmbId).join(', ')} - 不存在或不属于当前团队`
              );
            }
          } else {
            // 兼容旧格式：members 是字符串数组
            const validMembersResult = await MongoTeamMember.find({
              _id: { $in: members.map((id) => new Types.ObjectId(id)) },
              teamId: teamId,
              status: 'active'
            });

            validMembers = validMembersResult.map((member) => member._id.toString());

            // 检查是否有无效成员
            const invalidMembers = members.filter((id) => !validMembers.includes(id));
            if (invalidMembers.length > 0) {
              console.log(
                `[团队协作者更新] 忽略无效成员: ${invalidMembers.join(', ')} - 不存在或不属于当前团队`
              );
            }
          }
        }
      }

      // 处理组织列表
      let validOrgs: string[] = [];
      if (orgs && Array.isArray(orgs)) {
        if (orgs.length > 0) {
          // 支持新格式：orgs 是对象数组，包含 orgId 和 permission
          if (typeof orgs[0] === 'object' && orgs[0] !== null && 'orgId' in orgs[0]) {
            const orgIds = orgs.map((item: any) => new Types.ObjectId(item.orgId));
            const validOrgsResult = await MongoOrgModel.find({
              _id: { $in: orgIds },
              teamId: teamId
            });

            validOrgs = validOrgsResult.map((org) => org._id.toString());

            // 检查是否有无效组织
            const invalidOrgs = orgs.filter((item: any) => !validOrgs.includes(item.orgId));
            if (invalidOrgs.length > 0) {
              console.log(
                `[团队协作者更新] 忽略无效组织: ${invalidOrgs.map((o: any) => o.orgId).join(', ')} - 不存在或不属于当前团队`
              );
            }
          } else {
            // 兼容旧格式：orgs 是字符串数组
            const validOrgsResult = await MongoOrgModel.find({
              _id: { $in: orgs.map((id) => new Types.ObjectId(id)) },
              teamId: teamId
            });

            validOrgs = validOrgsResult.map((org) => org._id.toString());

            // 检查是否有无效组织
            const invalidOrgs = orgs.filter((id) => !validOrgs.includes(id));
            if (invalidOrgs.length > 0) {
              console.log(
                `[团队协作者更新] 忽略无效组织: ${invalidOrgs.join(', ')} - 不存在或不属于当前团队`
              );
            }
          }
        }
      }

      // 处理成员组列表
      let validGroups: string[] = [];
      if (groups && Array.isArray(groups)) {
        if (groups.length > 0) {
          // 支持新格式：groups 是对象数组，包含 groupId 和 permission
          if (typeof groups[0] === 'object' && groups[0] !== null && 'groupId' in groups[0]) {
            const groupIds = groups.map((item: any) => new Types.ObjectId(item.groupId));
            const validGroupsResult = await MongoMemberGroupModel.find({
              _id: { $in: groupIds },
              teamId: teamId
            });

            validGroups = validGroupsResult.map((group) => group._id.toString());

            // 检查是否有无效成员组
            const invalidGroups = groups.filter((item: any) => !validGroups.includes(item.groupId));
            if (invalidGroups.length > 0) {
              console.log(
                `[团队协作者更新] 忽略无效成员组: ${invalidGroups.map((g: any) => g.groupId).join(', ')} - 不存在或不属于当前团队`
              );
            }
          } else {
            // 兼容旧格式：groups 是字符串数组
            const validGroupsResult = await MongoMemberGroupModel.find({
              _id: { $in: groups.map((id) => new Types.ObjectId(id)) },
              teamId: teamId
            });

            validGroups = validGroupsResult.map((group) => group._id.toString());

            // 检查是否有无效成员组
            const invalidGroups = groups.filter((id) => !validGroups.includes(id));
            if (invalidGroups.length > 0) {
              console.log(
                `[团队协作者更新] 忽略无效成员组: ${invalidGroups.join(', ')} - 不存在或不属于当前团队`
              );
            }
          }
        }
      }

      // 使用事务更新协作者权限
      await mongoSessionRun(async (session) => {
        // 只更新/插入本次涉及的成员、组织、成员组权限，不删除其他

        // 更新成员权限
        if (validMembers.length > 0) {
          for (const memberId of validMembers) {
            // 查找对应的权限值
            let memberPermission = permission || 4; // 默认读取权限
            if (members && Array.isArray(members) && typeof members[0] === 'object') {
              const memberData = members.find((m: any) => m.tmbId === memberId);
              if (memberData && memberData.permission !== undefined) {
                memberPermission = memberData.permission;
              }
            }
            await MongoResourcePermission.updateOne(
              {
                teamId: new Types.ObjectId(teamId),
                tmbId: new Types.ObjectId(memberId),
                resourceType: PerResourceTypeEnum.team
              },
              {
                $set: {
                  permission: memberPermission
                }
              },
              { upsert: true, session }
            );
          }
        }

        // 更新组织权限
        if (validOrgs.length > 0) {
          for (const orgId of validOrgs) {
            let orgPermission = permission || 4;
            if (orgs && Array.isArray(orgs) && typeof orgs[0] === 'object') {
              const orgData = orgs.find((o: any) => o.orgId === orgId);
              if (orgData && orgData.permission !== undefined) {
                orgPermission = orgData.permission;
              }
            }
            await MongoResourcePermission.updateOne(
              {
                teamId: new Types.ObjectId(teamId),
                orgId: new Types.ObjectId(orgId),
                resourceType: PerResourceTypeEnum.team
              },
              {
                $set: {
                  permission: orgPermission
                }
              },
              { upsert: true, session }
            );
          }
        }

        // 更新成员组权限
        if (validGroups.length > 0) {
          for (const groupId of validGroups) {
            let groupPermission = permission || 4;
            if (groups && Array.isArray(groups) && typeof groups[0] === 'object') {
              const groupData = groups.find((g: any) => g.groupId === groupId);
              if (groupData && groupData.permission !== undefined) {
                groupPermission = groupData.permission;
              }
            }
            await MongoResourcePermission.updateOne(
              {
                teamId: new Types.ObjectId(teamId),
                groupId: new Types.ObjectId(groupId),
                resourceType: PerResourceTypeEnum.team
              },
              {
                $set: {
                  permission: groupPermission
                }
              },
              { upsert: true, session }
            );
          }
        }
      });

      // 统计更新结果
      const updateStats = {
        members: validMembers.length,
        groups: validGroups.length,
        orgs: validOrgs.length,
        total: validMembers.length + validGroups.length + validOrgs.length,
        ignored: {
          members: (members?.length || 0) - validMembers.length,
          groups: (groups?.length || 0) - validGroups.length,
          orgs: (orgs?.length || 0) - validOrgs.length
        }
      };

      jsonRes(res, {
        data: {
          teamId: teamId,
          ...updateStats,
          updateTime: new Date()
        },
        message: '团队协作者权限更新成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('更新团队协作者权限失败:', error);
    jsonRes(res, {
      code: 500,
      error: '更新失败'
    });
  }
}
