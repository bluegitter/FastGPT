import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoApp } from '@fastgpt/service/core/app/schema';
import { MongoDataset } from '@fastgpt/service/core/dataset/schema';
import { MongoDatasetCollection } from '@fastgpt/service/core/dataset/collection/schema';
import { MongoDatasetData } from '@fastgpt/service/core/dataset/data/schema';
import { MongoAppVersion } from '@fastgpt/service/core/app/version/schema';
import { MongoMcpKey } from '@fastgpt/service/support/mcp/schema';
import { MongoChatItem } from '@fastgpt/service/core/chat/chatItemSchema';
import { MongoChat } from '@fastgpt/service/core/chat/chatSchema';
import { MongoUsage } from '@fastgpt/service/support/wallet/usage/schema';
import { MongoOperationLog } from '@fastgpt/service/support/user/audit/schema';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { Types } from 'mongoose';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum
} from '@fastgpt/global/support/user/team/constant';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'DELETE') {
      // 获取当前团队成员信息
      const currentMember = await MongoTeamMember.findOne({
        _id: new Types.ObjectId(tmbId),
        teamId: new Types.ObjectId(teamId)
      }).lean();

      if (!currentMember) {
        return jsonRes(res, {
          code: 404,
          error: '团队成员不存在'
        });
      }

      // 检查是否为团队所有者
      if (currentMember.role === TeamMemberRoleEnum.owner) {
        return jsonRes(res, {
          code: 400,
          error: '团队所有者不能退出团队，请先转让团队所有权'
        });
      }

      // 获取团队所有者信息
      const teamOwner = await MongoTeamMember.findOne({
        teamId: new Types.ObjectId(teamId),
        role: TeamMemberRoleEnum.owner,
        status: TeamMemberStatusEnum.active
      }).lean();

      if (!teamOwner) {
        return jsonRes(res, {
          code: 404,
          error: '团队所有者不存在'
        });
      }

      // 分批处理资源转让，避免事务锁超时
      try {
        // 1. 转让应用所有权给团队所有者
        await MongoApp.updateMany(
          {
            teamId: new Types.ObjectId(teamId),
            tmbId: new Types.ObjectId(tmbId)
          },
          {
            $set: {
              tmbId: teamOwner._id
            }
          }
        );

        // 2. 转让知识库所有权给团队所有者
        await MongoDataset.updateMany(
          {
            teamId: new Types.ObjectId(teamId),
            tmbId: new Types.ObjectId(tmbId)
          },
          {
            $set: {
              tmbId: teamOwner._id
            }
          }
        );

        // 3. 转让知识库集合所有权给团队所有者
        await MongoDatasetCollection.updateMany(
          {
            teamId: new Types.ObjectId(teamId),
            tmbId: new Types.ObjectId(tmbId)
          },
          {
            $set: {
              tmbId: teamOwner._id
            }
          }
        );

        // 4. 转让知识库数据所有权给团队所有者
        await MongoDatasetData.updateMany(
          {
            teamId: new Types.ObjectId(teamId),
            tmbId: new Types.ObjectId(tmbId)
          },
          {
            $set: {
              tmbId: teamOwner._id
            }
          }
        );

        // 5. 转让应用版本所有权给团队所有者
        await MongoAppVersion.updateMany(
          {
            tmbId: tmbId
          },
          {
            $set: {
              tmbId: teamOwner._id.toString()
            }
          }
        );

        // 6. 转让MCP密钥所有权给团队所有者
        await MongoMcpKey.updateMany(
          {
            teamId: new Types.ObjectId(teamId),
            tmbId: new Types.ObjectId(tmbId)
          },
          {
            $set: {
              tmbId: teamOwner._id
            }
          }
        );

        // 7. 转让聊天记录所有权给团队所有者
        await MongoChatItem.updateMany(
          {
            teamId: new Types.ObjectId(teamId),
            tmbId: new Types.ObjectId(tmbId)
          },
          {
            $set: {
              tmbId: teamOwner._id
            }
          }
        );

        // 8. 转让聊天会话所有权给团队所有者
        await MongoChat.updateMany(
          {
            teamId: new Types.ObjectId(teamId),
            tmbId: new Types.ObjectId(tmbId)
          },
          {
            $set: {
              tmbId: teamOwner._id
            }
          }
        );

        // 9. 转让使用记录所有权给团队所有者
        await MongoUsage.updateMany(
          {
            teamId: new Types.ObjectId(teamId),
            tmbId: new Types.ObjectId(tmbId)
          },
          {
            $set: {
              tmbId: teamOwner._id
            }
          }
        );

        // 10. 转让操作日志所有权给团队所有者
        await MongoOperationLog.updateMany(
          {
            teamId: new Types.ObjectId(teamId),
            tmbId: new Types.ObjectId(tmbId)
          },
          {
            $set: {
              tmbId: teamOwner._id
            }
          }
        );

        // 11. 删除该成员的所有资源权限记录
        await MongoResourcePermission.deleteMany({
          teamId: new Types.ObjectId(teamId),
          tmbId: new Types.ObjectId(tmbId)
        });

        // 12. 删除该成员的群组成员关系
        await MongoGroupMemberModel.deleteMany({
          tmbId: new Types.ObjectId(tmbId)
        });

        // 13. 删除该成员的组织成员关系
        await MongoOrgMemberModel.deleteMany({
          teamId: new Types.ObjectId(teamId),
          tmbId: new Types.ObjectId(tmbId)
        });

        // 14. 将团队成员状态设置为非活跃
        await MongoTeamMember.updateOne(
          {
            _id: new Types.ObjectId(tmbId),
            teamId: new Types.ObjectId(teamId)
          },
          {
            $set: {
              status: TeamMemberStatusEnum.forbidden,
              updateTime: new Date()
            }
          }
        );

        jsonRes(res, {
          data: {
            message: '成功退出团队，所有资源已转让给团队所有者'
          }
        });
      } catch (transferError) {
        console.error('资源转让过程中出错:', transferError);
        // 如果转让过程中出错，尝试回滚团队成员状态
        try {
          await MongoTeamMember.updateOne(
            {
              _id: new Types.ObjectId(tmbId),
              teamId: new Types.ObjectId(teamId)
            },
            {
              $set: {
                status: TeamMemberStatusEnum.active,
                updateTime: new Date()
              }
            }
          );
        } catch (rollbackError) {
          console.error('回滚团队成员状态失败:', rollbackError);
        }

        return jsonRes(res, {
          code: 500,
          error: '资源转让失败，请稍后重试'
        });
      }
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('退出团队失败:', error);
    jsonRes(res, {
      code: 500,
      error: '退出团队失败'
    });
  }
}
