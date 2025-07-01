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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证 - 只有团队管理员或所有者可以更新协作者权限
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'POST') {
      const { members, groups, orgs, permission, datasetId } = req.body;

      if (!datasetId) {
        return jsonRes(res, {
          code: 400,
          error: 'datasetId不能为空'
        });
      }

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

      // 验证并过滤成员列表
      let validMembers: string[] = [];
      if (members && Array.isArray(members)) {
        if (members.length > 0) {
          const validMembersResult = await MongoTeamMember.find({
            _id: { $in: members.map((id) => new Types.ObjectId(id)) },
            teamId: teamId,
            status: 'active'
          });
          validMembers = validMembersResult.map((member) => member._id.toString());
          const invalidMembers = members.filter((id) => !validMembers.includes(id));
          if (invalidMembers.length > 0) {
            console.log(
              `[Dataset协作者更新] 忽略无效成员: ${invalidMembers.join(', ')} - 不存在或不属于当前团队`
            );
          }
        }
      }

      // 验证并过滤组织列表
      let validOrgs: string[] = [];
      if (orgs && Array.isArray(orgs)) {
        if (orgs.length > 0) {
          const validOrgsResult = await MongoOrgModel.find({
            _id: { $in: orgs.map((id) => new Types.ObjectId(id)) },
            teamId: teamId
          });
          validOrgs = validOrgsResult.map((org) => org._id.toString());
          const invalidOrgs = orgs.filter((id) => !validOrgs.includes(id));
          if (invalidOrgs.length > 0) {
            console.log(
              `[Dataset协作者更新] 忽略无效组织: ${invalidOrgs.join(', ')} - 不存在或不属于当前团队`
            );
          }
        }
      }

      // 验证并过滤成员组列表
      let validGroups: string[] = [];
      if (groups && Array.isArray(groups)) {
        if (groups.length > 0) {
          const validGroupsResult = await MongoMemberGroupModel.find({
            _id: { $in: groups.map((id) => new Types.ObjectId(id)) },
            teamId: teamId
          });
          validGroups = validGroupsResult.map((group) => group._id.toString());
          const invalidGroups = groups.filter((id) => !validGroups.includes(id));
          if (invalidGroups.length > 0) {
            console.log(
              `[Dataset协作者更新] 忽略无效成员组: ${invalidGroups.join(', ')} - 不存在或不属于当前团队`
            );
          }
        }
      }

      // 使用事务更新协作者权限
      await mongoSessionRun(async (session) => {
        // 只删除本次涉及的协作者权限（成员、组织、成员组）
        const deleteConditions = [];
        if (validMembers.length > 0) {
          deleteConditions.push({
            resourceType: PerResourceTypeEnum.dataset,
            teamId: new Types.ObjectId(teamId),
            resourceId: new Types.ObjectId(datasetId),
            tmbId: { $in: validMembers.map((id) => new Types.ObjectId(id)) }
          });
        }
        if (validOrgs.length > 0) {
          deleteConditions.push({
            resourceType: PerResourceTypeEnum.dataset,
            teamId: new Types.ObjectId(teamId),
            resourceId: new Types.ObjectId(datasetId),
            orgId: { $in: validOrgs.map((id) => new Types.ObjectId(id)) }
          });
        }
        if (validGroups.length > 0) {
          deleteConditions.push({
            resourceType: PerResourceTypeEnum.dataset,
            teamId: new Types.ObjectId(teamId),
            resourceId: new Types.ObjectId(datasetId),
            groupId: { $in: validGroups.map((id) => new Types.ObjectId(id)) }
          });
        }
        if (deleteConditions.length > 0) {
          await MongoResourcePermission.deleteMany({ $or: deleteConditions }, { session });
        }

        // 分别 upsert 新的权限记录
        // 添加成员权限
        if (validMembers.length > 0) {
          for (const memberId of validMembers) {
            await MongoResourcePermission.updateOne(
              {
                teamId: new Types.ObjectId(teamId),
                tmbId: new Types.ObjectId(memberId),
                resourceType: PerResourceTypeEnum.dataset,
                resourceId: new Types.ObjectId(datasetId)
              },
              {
                $set: {
                  permission: permission || 4
                }
              },
              { upsert: true, session }
            );
          }
        }

        // 添加组织权限
        if (validOrgs.length > 0) {
          for (const orgId of validOrgs) {
            await MongoResourcePermission.updateOne(
              {
                teamId: new Types.ObjectId(teamId),
                orgId: new Types.ObjectId(orgId),
                resourceType: PerResourceTypeEnum.dataset,
                resourceId: new Types.ObjectId(datasetId)
              },
              {
                $set: {
                  permission: permission || 4
                }
              },
              { upsert: true, session }
            );
          }
        }

        // 添加成员组权限
        if (validGroups.length > 0) {
          for (const groupId of validGroups) {
            await MongoResourcePermission.updateOne(
              {
                teamId: new Types.ObjectId(teamId),
                groupId: new Types.ObjectId(groupId),
                resourceType: PerResourceTypeEnum.dataset,
                resourceId: new Types.ObjectId(datasetId)
              },
              {
                $set: {
                  permission: permission || 4
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
          datasetId,
          ...updateStats,
          permission: permission || 4,
          updateTime: new Date()
        },
        message: 'Dataset协作者权限更新成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('更新Dataset协作者权限失败:', error);
    jsonRes(res, {
      code: 500,
      error: '更新失败'
    });
  }
}
