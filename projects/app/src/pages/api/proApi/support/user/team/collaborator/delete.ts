import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { PerResourceTypeEnum } from '@fastgpt/global/support/permission/constant';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证 - 只有团队管理员或所有者可以删除协作者权限
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'DELETE') {
      const { tmbId, groupId, orgId } = req.query;

      // 参数验证 - 必须提供其中一个ID
      if (!tmbId && !groupId && !orgId) {
        return jsonRes(res, {
          code: 400,
          error: '必须提供 tmbId、groupId 或 orgId 中的一个'
        });
      }

      // 构建删除条件
      const deleteCondition: any = {
        resourceType: PerResourceTypeEnum.team,
        teamId: new Types.ObjectId(teamId)
      };

      if (tmbId) {
        deleteCondition.tmbId = new Types.ObjectId(tmbId as string);
      } else if (groupId) {
        deleteCondition.groupId = new Types.ObjectId(groupId as string);
      } else if (orgId) {
        deleteCondition.orgId = new Types.ObjectId(orgId as string);
      }

      // 删除协作者权限
      const result = await MongoResourcePermission.deleteOne(deleteCondition);

      if (result.deletedCount === 0) {
        return jsonRes(res, {
          code: 404,
          error: '未找到指定的协作者权限记录'
        });
      }

      jsonRes(res, {
        data: {
          teamId: teamId,
          deletedCount: result.deletedCount,
          deletedType: tmbId ? 'member' : groupId ? 'group' : 'org',
          deletedId: tmbId || groupId || orgId
        },
        message: '协作者权限删除成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('删除团队协作者权限失败:', error);
    jsonRes(res, {
      code: 500,
      error: '删除失败'
    });
  }
}
