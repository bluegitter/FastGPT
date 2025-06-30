import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'POST') {
      const { searchKey = '', withMembers = false } = req.body;

      // 构建查询条件
      const match: any = {
        teamId: new Types.ObjectId(teamId)
      };

      // 搜索条件
      if (searchKey) {
        match.name = { $regex: searchKey, $options: 'i' };
      }

      // 查询成员组列表
      const groups = await MongoMemberGroupModel.find(match).sort({ updateTime: -1 }).lean();

      // 如果需要成员信息，为每个组查询成员
      const groupsWithMembers = await Promise.all(
        groups.map(async (group) => {
          if (!withMembers) {
            return {
              _id: group._id,
              teamId: group.teamId,
              name: group.name,
              avatar: group.avatar || '/icon/logo.svg',
              updateTime: group.updateTime
            };
          }

          // 查询组成员
          const groupMembers = await MongoGroupMemberModel.find({
            groupId: group._id
          }).lean();

          // 获取成员详细信息
          const memberDetails = await Promise.all(
            groupMembers.map(async (groupMember) => {
              const teamMember = await MongoTeamMember.findById(groupMember.tmbId).lean();
              if (!teamMember) return null;

              return {
                tmbId: teamMember._id,
                name: teamMember.name,
                avatar: teamMember.avatar || '/icon/human.svg',
                role: groupMember.role
              };
            })
          );

          const validMembers = memberDetails.filter(Boolean);

          // 查找组所有者（role为owner的成员）
          const owner = validMembers.find((member) => member && member.role === 'owner');

          return {
            _id: group._id,
            teamId: group.teamId,
            name: group.name,
            avatar: group.avatar || '/icon/logo.svg',
            updateTime: group.updateTime,
            members: validMembers,
            count: validMembers.length,
            owner: owner
              ? {
                  tmbId: owner.tmbId,
                  name: owner.name,
                  avatar: owner.avatar
                }
              : undefined,
            permission: {
              // 简化权限处理，实际应该根据当前用户权限判断
              hasManagePer: true,
              isOwner: false
            }
          };
        })
      );

      jsonRes(res, {
        data: groupsWithMembers
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('获取成员组列表失败:', error);
    jsonRes(res, {
      code: 500,
      error: '获取失败'
    });
  }
}
