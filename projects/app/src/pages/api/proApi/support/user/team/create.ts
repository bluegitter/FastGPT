import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { DefaultGroupName } from '@fastgpt/global/support/user/team/group/constant';
import { createRootOrg } from '@fastgpt/service/support/permission/org/controllers';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import type { CreateTeamProps } from '@fastgpt/global/support/user/team/controller.d';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { userId } = await authCert({ req, authToken: true });

    if (req.method === 'POST') {
      const { name, avatar = '/icon/logo.svg', notificationAccount } = req.body as CreateTeamProps;

      if (!name || !name.trim()) {
        return jsonRes(res, {
          code: 400,
          error: '团队名称不能为空'
        });
      }

      // 检查团队名称是否已存在
      const existingTeam = await MongoTeam.findOne({ name: name.trim() });
      if (existingTeam) {
        return jsonRes(res, {
          code: 400,
          error: '团队名称已存在'
        });
      }

      // 使用事务创建团队和相关数据
      const result = await mongoSessionRun(async (session) => {
        // 创建团队
        const [team] = await MongoTeam.create(
          [
            {
              name: name.trim(),
              ownerId: userId,
              avatar: avatar,
              createTime: new Date(),
              balance: 100000, // 默认余额
              teamDomain: '', // 默认空域名
              limit: {
                lastExportDatasetTime: new Date(),
                lastWebsiteSyncTime: new Date()
              },
              notificationAccount: notificationAccount || undefined
            }
          ],
          { session }
        );

        // 创建默认成员组
        await MongoMemberGroupModel.create(
          [
            {
              teamId: team._id,
              name: DefaultGroupName,
              avatar: avatar
            }
          ],
          { session }
        );

        // 创建根组织
        await createRootOrg({ teamId: team._id, session });

        return {
          teamId: team._id,
          teamName: team.name
        };
      });

      jsonRes(res, {
        data: result.teamId,
        message: '团队创建成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('创建团队失败:', error);
    jsonRes(res, {
      code: 500,
      error: error instanceof Error ? error.message : '创建团队失败'
    });
  }
}
