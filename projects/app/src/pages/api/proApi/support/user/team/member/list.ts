import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
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
        withPermission = false
      } = req.body;

      // 构建查询条件 - 只查询当前团队的成员
      const match: any = {
        $or: [{ teamId: new Types.ObjectId(teamId) }]
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

      // 分页查询
      const skip = (Number(page) - 1) * Number(pageSize);
      const limit = Number(pageSize);

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
        },
        {
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
            // 部门信息 - 这里可以根据实际需求添加部门查询
            orgs: withOrgs ? [] : undefined, // 暂时返回空数组，后续可以添加部门查询
            // 权限信息
            permission: withPermission
              ? {
                  hasManagePer: { $eq: ['$role', TeamMemberRoleEnum.owner] },
                  isOwner: { $eq: ['$role', TeamMemberRoleEnum.owner] }
                }
              : undefined
          }
        },
        { $sort: { createTime: -1 } },
        { $skip: skip },
        { $limit: limit }
      ];

      const [members, total] = await Promise.all([
        MongoTeamMember.aggregate(pipeline),
        MongoTeamMember.countDocuments(match)
      ]);

      // 格式化返回数据
      const formattedMembers = members.map((member) => ({
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
        orgs: member.orgs || [],
        permission: member.permission || {
          hasManagePer: member.role === TeamMemberRoleEnum.owner,
          isOwner: member.role === TeamMemberRoleEnum.owner
        }
      }));

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
