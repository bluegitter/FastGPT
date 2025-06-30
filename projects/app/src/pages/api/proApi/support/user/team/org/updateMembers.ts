import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证 - 只有团队管理员或所有者可以更新组织成员
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'PUT') {
      const { orgId, members } = req.body;

      // 参数验证 - 允许空字符串表示根组织
      if (orgId === undefined || orgId === null) {
        return jsonRes(res, {
          code: 400,
          error: '组织ID不能为空'
        });
      }

      if (!Array.isArray(members)) {
        return jsonRes(res, {
          code: 400,
          error: '成员列表格式错误'
        });
      }

      // 验证组织是否存在且属于当前团队
      let org = null;
      if (orgId === '') {
        // 根组织：查找 path 为空字符串的组织
        org = await MongoOrgModel.findOne({
          teamId: teamId,
          path: ''
        });

        if (!org) {
          return jsonRes(res, {
            code: 404,
            error: '根组织不存在'
          });
        }
      } else {
        // 普通组织
        org = await MongoOrgModel.findOne({
          _id: orgId,
          teamId: teamId
        });

        if (!org) {
          return jsonRes(res, {
            code: 404,
            error: '组织不存在或无权限访问'
          });
        }
      }

      // 验证并过滤成员列表
      const memberIds = members.map((m) => m.tmbId);
      const validMembersResult = await MongoTeamMember.find({
        _id: { $in: memberIds },
        teamId: teamId,
        status: TeamMemberStatusEnum.active
      });

      // 过滤出有效的成员
      const validMembers = validMembersResult.map((member) => member._id.toString());
      const validMemberData = members.filter((member) => validMembers.includes(member.tmbId));

      // 检查是否有无效成员
      const invalidMembers = memberIds.filter((id) => !validMembers.includes(id));
      if (invalidMembers.length > 0) {
        console.log(
          `[组织成员更新] 忽略无效成员: ${invalidMembers.join(', ')} - 不存在或不属于当前团队`
        );
      }

      // 使用事务更新组织成员
      await mongoSessionRun(async (session) => {
        // 删除当前组织的所有成员
        await MongoOrgMemberModel.deleteMany({ orgId: new Types.ObjectId(org._id) }, { session });

        // 添加新的有效成员
        if (validMemberData.length > 0) {
          const orgMembers = validMemberData.map((member) => ({
            orgId: new Types.ObjectId(org._id),
            tmbId: new Types.ObjectId(member.tmbId),
            teamId: new Types.ObjectId(teamId),
            createTime: new Date()
          }));

          await MongoOrgMemberModel.insertMany(orgMembers, { session });
        }
      });

      jsonRes(res, {
        data: {
          orgId: org._id,
          memberCount: validMemberData.length,
          totalRequested: members.length,
          ignoredCount: invalidMembers.length,
          updateTime: new Date()
        },
        message: '组织成员更新成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('更新组织成员失败:', error);
    jsonRes(res, {
      code: 500,
      error: '更新失败'
    });
  }
}
