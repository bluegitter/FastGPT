import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { PerResourceTypeEnum } from '@fastgpt/global/support/permission/constant';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    // 支持 GET 和 POST
    const datasetId = req.method === 'GET' ? req.query.datasetId : req.body.datasetId;
    if (!datasetId) {
      return jsonRes(res, {
        code: 400,
        error: 'datasetId不能为空'
      });
    }

    // 查询当前 dataset 的所有协作者权限
    const collaborators = await MongoResourcePermission.find({
      resourceType: PerResourceTypeEnum.dataset,
      teamId: new Types.ObjectId(teamId),
      resourceId: new Types.ObjectId(datasetId)
    }).lean();

    // 分类处理不同类型的协作者
    const memberIds = collaborators.filter((c) => c.tmbId).map((c) => c.tmbId);
    const orgIds = collaborators.filter((c) => c.orgId).map((c) => c.orgId);
    const groupIds = collaborators.filter((c) => c.groupId).map((c) => c.groupId);

    // 并行查询详细信息
    const [members, orgs, groups] = await Promise.all([
      // 查询成员信息
      memberIds.length > 0
        ? MongoTeamMember.aggregate([
            { $match: { _id: { $in: memberIds } } },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userInfo'
              }
            },
            { $unwind: '$userInfo' },
            {
              $project: {
                tmbId: '$_id',
                name: '$name',
                avatar: { $ifNull: ['$avatar', '$userInfo.avatar'] }
              }
            }
          ])
        : [],
      // 查询组织信息
      orgIds.length > 0
        ? MongoOrgModel.find({ _id: { $in: orgIds } })
            .select('name avatar')
            .lean()
            .then((orgs) =>
              orgs.map((org) => ({
                orgId: org._id,
                name: org.name,
                avatar: org.avatar || '/icon/org.svg'
              }))
            )
        : [],
      // 查询成员组信息
      groupIds.length > 0
        ? MongoMemberGroupModel.find({ _id: { $in: groupIds } })
            .select('name avatar')
            .lean()
            .then((groups) =>
              groups.map((group) => ({
                groupId: group._id,
                name: group.name,
                avatar: group.avatar || '/icon/group.svg'
              }))
            )
        : []
    ]);

    // 构建返回数据
    const result = [];
    // 添加成员协作者
    for (const member of members) {
      const permission = collaborators.find(
        (c) => c.tmbId && c.tmbId.toString() === member.tmbId.toString()
      );
      result.push({
        tmbId: member.tmbId,
        name: member.name,
        avatar: member.avatar || '/icon/human.svg',
        permission: {
          value: permission?.permission || 4,
          hasManagePer: false,
          isOwner: false
        }
      });
    }
    // 添加组织协作者
    for (const org of orgs) {
      const permission = collaborators.find(
        (c) => c.orgId && c.orgId.toString() === org.orgId.toString()
      );
      result.push({
        orgId: org.orgId,
        name: org.name,
        avatar: org.avatar,
        permission: {
          value: permission?.permission || 4,
          hasManagePer: false,
          isOwner: false
        }
      });
    }
    // 添加成员组协作者
    for (const group of groups) {
      const permission = collaborators.find(
        (c) => c.groupId && c.groupId.toString() === group.groupId.toString()
      );
      result.push({
        groupId: group.groupId,
        name: group.name,
        avatar: group.avatar,
        permission: {
          value: permission?.permission || 4,
          hasManagePer: false,
          isOwner: false
        }
      });
    }

    jsonRes(res, {
      data: result
    });
  } catch (error) {
    console.error('获取Dataset协作者列表失败:', error);
    jsonRes(res, {
      code: 500,
      error: '获取失败'
    });
  }
}
