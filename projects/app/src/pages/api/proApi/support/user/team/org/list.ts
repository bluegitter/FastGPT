import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'POST') {
      const { orgId = '', searchKey = '', withPermission = false } = req.body;

      // 构建查询条件
      const match: any = {
        teamId: new Types.ObjectId(teamId)
      };

      // 根据 orgId 查询子组织
      if (orgId) {
        // 查找指定组织的子组织
        const parentOrg = await MongoOrgModel.findOne({
          _id: orgId,
          teamId: new Types.ObjectId(teamId)
        });

        if (!parentOrg) {
          return jsonRes(res, {
            code: 404,
            error: '父组织不存在'
          });
        }

        // 查询直接子组织（path 以父组织的 path/pathId 开头）
        match.path = `${parentOrg.path}/${parentOrg.pathId}`;
      } else {
        // 查询根组织（path 为空字符串）
        match.path = '';
      }

      // 搜索条件
      if (searchKey) {
        match.name = { $regex: searchKey, $options: 'i' };
      }

      // 查询组织列表
      const orgs = await MongoOrgModel.find(match).sort({ updateTime: -1 }).lean();

      // 为每个组织计算成员数量
      const orgsWithMemberCount = await Promise.all(
        orgs.map(async (org) => {
          // 计算该组织的成员数量
          const memberCount = await MongoOrgMemberModel.countDocuments({
            orgId: org._id
          });

          // 计算子组织数量
          const childOrgCount = await MongoOrgModel.countDocuments({
            teamId: new Types.ObjectId(teamId),
            path: { $regex: `^${org.path}/${org.pathId}` }
          });

          return {
            _id: org._id,
            teamId: org.teamId,
            pathId: org.pathId,
            path: org.path,
            name: org.name,
            avatar: org.avatar || '/icon/logo.svg',
            description: org.description || '',
            updateTime: org.updateTime,
            total: memberCount + childOrgCount, // 成员数量 + 子组织数量
            permission: withPermission
              ? {
                  hasManagePer: true, // 简化处理，实际应该根据用户权限判断
                  isOwner: false
                }
              : undefined
          };
        })
      );

      // 默认分页参数
      const page = 1;
      const pageSize = 20;

      jsonRes(res, {
        data: orgsWithMemberCount
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('获取团队组织列表失败:', error);
    jsonRes(res, {
      code: 500,
      error: '获取失败'
    });
  }
}
