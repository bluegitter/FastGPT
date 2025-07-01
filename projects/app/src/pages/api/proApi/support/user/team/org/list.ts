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

      console.log('[组织列表] 请求参数:', { orgId, searchKey, withPermission, teamId });

      // 构建查询条件
      const match: any = {
        teamId: new Types.ObjectId(teamId)
      };

      // 根据 orgId 查询子组织
      if (orgId && orgId !== '') {
        // 查找指定组织的子组织
        const parentOrg = await MongoOrgModel.findOne({
          _id: orgId,
          teamId: new Types.ObjectId(teamId)
        });

        if (!parentOrg) {
          console.log('[组织列表] 父组织不存在:', orgId);
          return jsonRes(res, {
            code: 404,
            error: '父组织不存在'
          });
        }

        // 查询直接子组织
        if (parentOrg.path === 'ROOT') {
          // 父组织是根组织，查询 path 为 "/ROOT/父组织名称" 的子组织
          match.path = `/ROOT/${parentOrg.name}`;
        } else if (parentOrg.path.startsWith('/ROOT/')) {
          // 父组织是子组织，查询 path 为 "父组织路径/父组织名称" 的子组织
          match.path = `${parentOrg.path}/${parentOrg.name}`;
        } else {
          // 兼容旧格式，使用原来的逻辑
          match.path = `${parentOrg.path}/${parentOrg.pathId}`;
        }
        console.log('[组织列表] 查询子组织，path条件:', match.path);
      } else {
        // 查询根组织（path 为 "ROOT"）
        match.path = 'ROOT';
        console.log('[组织列表] 查询根组织');
      }

      // 搜索条件
      if (searchKey) {
        match.name = { $regex: searchKey, $options: 'i' };
      }

      console.log('[组织列表] 最终查询条件:', JSON.stringify(match, null, 2));

      // 查询组织列表
      const orgs = await MongoOrgModel.find(match).sort({ updateTime: -1 }).lean();

      console.log('[组织列表] 查询到组织数量:', orgs.length);

      // 为每个组织计算成员数量
      const orgsWithMemberCount = await Promise.all(
        orgs.map(async (org) => {
          // 计算该组织的成员数量
          const memberCount = await MongoOrgMemberModel.countDocuments({
            orgId: org._id
          });

          // 计算子组织数量
          let childOrgCount = 0;
          if (org.path === 'ROOT') {
            // 根组织，查询 path 为 "/ROOT/根组织名称" 的子组织
            childOrgCount = await MongoOrgModel.countDocuments({
              teamId: new Types.ObjectId(teamId),
              path: `/ROOT/${org.name}`
            });
          } else if (org.path.startsWith('/ROOT/')) {
            // 子组织，查询 path 为 "当前组织路径/当前组织名称" 的子组织
            childOrgCount = await MongoOrgModel.countDocuments({
              teamId: new Types.ObjectId(teamId),
              path: `${org.path}/${org.name}`
            });
          } else {
            // 兼容旧格式，使用原来的逻辑
            childOrgCount = await MongoOrgModel.countDocuments({
              teamId: new Types.ObjectId(teamId),
              path: { $regex: `^${org.path}/${org.pathId}` }
            });
          }

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

      console.log('[组织列表] 返回数据:', {
        count: orgsWithMemberCount.length,
        orgs: orgsWithMemberCount.map((org) => ({ _id: org._id, name: org.name, path: org.path }))
      });

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
