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
      const { tmbId: targetTmbId, groupId, orgId, datasetId } = req.query;

      // 参数验证 - datasetId 必须提供
      if (!datasetId) {
        return jsonRes(res, {
          code: 400,
          error: 'datasetId不能为空'
        });
      }

      // 参数验证 - 必须提供其中一个ID
      if (!targetTmbId && !groupId && !orgId) {
        return jsonRes(res, {
          code: 400,
          error: '必须提供 tmbId、groupId 或 orgId 中的一个'
        });
      }

      // 构建删除条件
      const deleteCondition: any = {
        resourceType: PerResourceTypeEnum.dataset,
        teamId: new Types.ObjectId(teamId),
        resourceId: new Types.ObjectId(datasetId as string)
      };

      if (targetTmbId) {
        deleteCondition.tmbId = new Types.ObjectId(targetTmbId as string);
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
          datasetId: datasetId,
          teamId: teamId,
          deletedCount: result.deletedCount,
          deletedType: targetTmbId ? 'member' : groupId ? 'group' : 'org',
          deletedId: targetTmbId || groupId || orgId
        },
        message: '数据集协作者权限删除成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('删除数据集协作者权限失败:', error);
    jsonRes(res, {
      code: 500,
      error: '删除失败'
    });
  }
}
