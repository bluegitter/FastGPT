import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum
} from '@fastgpt/global/support/user/team/constant';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'POST') {
      const {
        page = 1,
        pageSize = 20,
        status,
        searchKey,
        withOrgs = false,
        withPermission = false,
        orgId,
        groupId
      } = req.body;

      console.log('[团队成员列表] 请求参数:', {
        page,
        pageSize,
        status,
        searchKey,
        withOrgs,
        withPermission,
        orgId,
        groupId,
        teamId
      });

      // 构建查询条件 - 只查询当前团队的成员
      const match: any = {
        teamId: new Types.ObjectId(teamId)
      };

      if (status) {
        match.status = status;
      }

      // 搜索条件
      if (searchKey) {
        match.$or = [
          { name: { $regex: searchKey, $options: 'i' } },
          { userId: { $regex: searchKey, $options: 'i' } }
        ];
      }

      // 如果提供了 orgId，过滤该部门下的成员
      let orgMemberIds: string[] = [];
      if (orgId) {
        console.log('[团队成员列表] 查询部门成员，orgId:', orgId);

        // 查询该部门下的所有成员ID
        const orgMembers = await MongoOrgMemberModel.find({
          orgId: new Types.ObjectId(orgId),
          teamId: new Types.ObjectId(teamId)
        }).lean();

        orgMemberIds = orgMembers.map((member) => member.tmbId.toString());
        console.log('[团队成员列表] 部门成员数量:', orgMemberIds.length);

        if (orgMemberIds.length === 0) {
          // 如果部门下没有成员，直接返回空结果
          jsonRes(res, {
            data: {
              list: [],
              total: 0,
              page: Number(page),
              pageSize: Number(pageSize)
            }
          });
          return;
        }

        // 添加部门成员过滤条件
        match._id = { $in: orgMemberIds.map((id) => new Types.ObjectId(id)) };
      }

      // 如果提供了 groupId，过滤该群组下的成员
      let groupMemberIds: string[] = [];
      if (groupId) {
        console.log('[团队成员列表] 查询群组成员，groupId:', groupId);

        // 查询该群组下的所有成员ID
        const groupMembers = await MongoGroupMemberModel.find({
          groupId: new Types.ObjectId(groupId)
        }).lean();

        groupMemberIds = groupMembers.map((member) => member.tmbId.toString());
        console.log('[团队成员列表] 群组成员数量:', groupMemberIds.length);

        if (groupMemberIds.length === 0) {
          // 如果群组下没有成员，直接返回空结果
          jsonRes(res, {
            data: {
              list: [],
              total: 0,
              page: Number(page),
              pageSize: Number(pageSize)
            }
          });
          return;
        }

        // 添加群组成员过滤条件
        if (orgId) {
          // 如果同时提供了 orgId 和 groupId，取交集
          const intersection = orgMemberIds.filter((id) => groupMemberIds.includes(id));
          match._id = { $in: intersection.map((id) => new Types.ObjectId(id)) };
        } else {
          match._id = { $in: groupMemberIds.map((id) => new Types.ObjectId(id)) };
        }
      }

      // 分页查询
      const skip = (Number(page) - 1) * Number(pageSize);
      const limit = Number(pageSize);

      console.log('[团队成员列表] 最终查询条件:', JSON.stringify(match, null, 2));

      // 聚合查询，获取完整的用户、团队、部门信息
      const pipeline: any[] = [
        { $match: match },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        {
          $lookup: {
            from: 'teams',
            localField: 'teamId',
            foreignField: '_id',
            as: 'teamInfo'
          }
        },
        {
          $unwind: {
            path: '$userInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$teamInfo',
            preserveNullAndEmptyArrays: true
          }
        }
      ];

      // 如果需要部门信息，添加部门查询
      if (withOrgs) {
        pipeline.push({
          $lookup: {
            from: 'team_org_members',
            localField: '_id',
            foreignField: 'tmbId',
            as: 'orgMembers'
          }
        });
      }

      pipeline.push({
        $project: {
          tmbId: '$_id',
          userId: '$userId',
          username: '$userInfo.username',
          memberName: '$name',
          avatar: { $ifNull: ['$avatar', '$userInfo.avatar'] },
          teamId: '$teamId',
          teamName: '$teamInfo.name',
          role: '$role',
          status: '$status',
          createTime: '$createTime',
          updateTime: '$updateTime',
          // 部门信息
          orgs: withOrgs ? '$orgMembers' : undefined,
          // 权限信息
          permission: withPermission
            ? {
                hasManagePer: { $eq: ['$role', TeamMemberRoleEnum.owner] },
                isOwner: { $eq: ['$role', TeamMemberRoleEnum.owner] }
              }
            : undefined
        }
      });

      pipeline.push({ $sort: { createTime: -1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      const [members, total] = await Promise.all([
        MongoTeamMember.aggregate(pipeline),
        MongoTeamMember.countDocuments(match)
      ]);

      console.log('[团队成员列表] 查询结果:', { membersCount: members.length, total });

      // 如果需要部门信息，获取所有相关的组织信息并构建路径
      let orgPathMap: Map<string, string> = new Map();
      if (withOrgs && members.some((member) => member.orgs && member.orgs.length > 0)) {
        // 收集所有组织ID
        const orgIds = new Set<string>();
        members.forEach((member) => {
          if (member.orgs && Array.isArray(member.orgs)) {
            member.orgs.forEach((orgMember: any) => {
              if (orgMember.orgId) {
                orgIds.add(orgMember.orgId.toString());
              }
            });
          }
        });

        if (orgIds.size > 0) {
          console.log('[团队成员列表] 查询组织信息，组织ID数量:', orgIds.size);

          // 查询所有相关组织
          const orgs = await MongoOrgModel.find({
            _id: { $in: Array.from(orgIds).map((id) => new Types.ObjectId(id)) },
            teamId: new Types.ObjectId(teamId)
          }).lean();

          // 构建组织路径映射
          const teamName = members[0]?.teamName || '团队';
          orgs.forEach((org) => {
            let path = '';
            if (org.path === '') {
              // 根组织
              path = `/${teamName}`;
            } else {
              // 普通组织，path 格式为 /ROOT/一级部门名称
              const pathParts = org.path.split('/').filter((part) => part !== '');
              if (pathParts[0] === 'ROOT') {
                path = `/${teamName}/${pathParts.slice(1).join('/')}`;
              } else {
                path = `/${teamName}/${org.path}`;
              }
            }
            orgPathMap.set(org._id.toString(), path);
          });

          console.log('[团队成员列表] 组织路径映射:', Object.fromEntries(orgPathMap));
        }
      }

      // 格式化返回数据
      const formattedMembers = members.map((member) => {
        // 构建组织路径数组
        let orgPaths: string[] = [];
        if (withOrgs && member.orgs && Array.isArray(member.orgs)) {
          member.orgs.forEach((orgMember: any) => {
            if (orgMember.orgId) {
              const orgPath = orgPathMap.get(orgMember.orgId.toString());
              if (orgPath) {
                orgPaths.push(orgPath);
              }
            }
          });
        }

        return {
          tmbId: member.tmbId,
          userId: member.userId,
          username: member.username,
          memberName: member.memberName,
          avatar: member.avatar || '/icon/human.svg',
          teamId: member.teamId,
          teamName: member.teamName || '未知团队',
          role: member.role,
          status: member.status,
          createTime: member.createTime,
          updateTime: member.updateTime,
          orgs: orgPaths,
          permission: member.permission || {
            hasManagePer: member.role === TeamMemberRoleEnum.owner,
            isOwner: member.role === TeamMemberRoleEnum.owner
          }
        };
      });

      jsonRes(res, {
        data: {
          list: formattedMembers,
          total,
          page: Number(page),
          pageSize: Number(pageSize)
        }
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('获取团队成员列表失败:', error);
    jsonRes(res, {
      code: 500,
      error
    });
  }
}
