import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { Types } from 'mongoose';
import { getNanoid } from '@fastgpt/global/common/string/tools';
import { getOrgChildrenPath } from '@fastgpt/global/support/user/team/org/constant';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证 - 只有团队管理员或所有者可以创建组织
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'POST') {
      const { name, avatar = '', orgId = '', description = '' } = req.body;

      console.log('[创建组织] 请求参数:', { name, avatar, orgId, description, teamId });

      // 参数验证
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return jsonRes(res, {
          code: 400,
          error: '组织名称不能为空'
        });
      }

      if (name.trim().length > 50) {
        return jsonRes(res, {
          code: 400,
          error: '组织名称不能超过50个字符'
        });
      }

      // 验证父组织是否存在且属于当前团队
      let parentOrg = null;
      let parentPath = '';
      let parentPathId = '';

      if (orgId) {
        parentOrg = await MongoOrgModel.findOne({
          _id: orgId,
          teamId: teamId
        });

        if (!parentOrg) {
          return jsonRes(res, {
            code: 404,
            error: '父组织不存在或无权限访问'
          });
        }

        parentPath = parentOrg.path;
        parentPathId = parentOrg.pathId;
        console.log('[创建组织] 父组织信息:', {
          parentOrgId: orgId,
          parentPath,
          parentPathId,
          parentName: parentOrg.name
        });
      } else {
        console.log('[创建组织] 创建一级部门（根组织）');
      }

      // 检查同级组织名称是否重复
      const existingOrg = await MongoOrgModel.findOne({
        teamId: teamId,
        path: parentPath,
        name: name.trim()
      });

      if (existingOrg) {
        return jsonRes(res, {
          code: 400,
          error: '同级组织下已存在相同名称的组织'
        });
      }

      // 使用事务创建组织
      let newOrg: any;
      await mongoSessionRun(async (session) => {
        // 生成新的路径ID
        const newPathId = getNanoid();

        // 构建新组织的路径
        let newPath = '';
        if (orgId && parentOrg) {
          // 创建子组织
          if (parentPath === 'ROOT') {
            // 父组织是根组织，子组织路径为 "/ROOT/父组织名称"
            newPath = `/ROOT/${parentOrg.name}`;
          } else if (parentPath.startsWith('/ROOT/')) {
            // 父组织已经是子组织，子组织路径为 "父组织路径/父组织名称"
            newPath = `${parentPath}/${parentOrg.name}`;
          } else {
            // 其他情况，使用原来的逻辑
            newPath = parentPath ? `${parentPath}/${parentPathId}` : '';
          }
        } else {
          // 创建一级部门（根组织），path 设置为 "ROOT"
          newPath = 'ROOT';
        }

        console.log('[创建组织] 路径构建:', {
          orgId,
          parentPath,
          parentPathId,
          newPath,
          newPathId
        });

        // 创建新组织
        newOrg = await MongoOrgModel.create(
          [
            {
              teamId: new Types.ObjectId(teamId),
              pathId: newPathId,
              path: newPath,
              name: name.trim(),
              avatar: avatar || '/icon/logo.svg',
              description: description || '',
              createTime: new Date(),
              updateTime: new Date()
            }
          ],
          { session }
        );
      });

      if (!newOrg || !newOrg[0]) {
        return jsonRes(res, {
          code: 500,
          error: '组织创建失败'
        });
      }

      console.log('[创建组织] 创建成功:', {
        _id: newOrg[0]._id,
        name: newOrg[0].name,
        path: newOrg[0].path,
        pathId: newOrg[0].pathId
      });

      jsonRes(res, {
        data: {
          _id: newOrg[0]._id,
          teamId: newOrg[0].teamId,
          pathId: newOrg[0].pathId,
          path: newOrg[0].path,
          name: newOrg[0].name,
          avatar: newOrg[0].avatar,
          description: newOrg[0].description,
          createTime: newOrg[0].createTime,
          updateTime: newOrg[0].updateTime
        },
        message: '组织创建成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('创建组织失败:', error);
    jsonRes(res, {
      code: 500,
      error: '创建失败'
    });
  }
}
