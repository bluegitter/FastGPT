import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证 - 只有团队管理员或所有者可以删除组织成员
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'DELETE') {
      const { orgId, tmbId: targetTmbId } = req.query;

      // 参数验证
      if (!orgId) {
        return jsonRes(res, {
          code: 400,
          error: '组织ID不能为空'
        });
      }

      if (!targetTmbId) {
        return jsonRes(res, {
          code: 400,
          error: '成员ID不能为空'
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

      // 验证成员是否存在且属于当前团队
      const member = await MongoTeamMember.findOne({
        _id: targetTmbId as string,
        teamId: teamId,
        status: TeamMemberStatusEnum.active
      });

      if (!member) {
        return jsonRes(res, {
          code: 404,
          error: '成员不存在或不属于当前团队'
        });
      }

      // 验证成员是否在该组织中
      const orgMember = await MongoOrgMemberModel.findOne({
        orgId: new Types.ObjectId(org._id),
        tmbId: new Types.ObjectId(targetTmbId as string),
        teamId: new Types.ObjectId(teamId)
      });

      if (!orgMember) {
        return jsonRes(res, {
          code: 404,
          error: '该成员不在指定组织中'
        });
      }

      // 删除组织成员关系
      const result = await MongoOrgMemberModel.deleteOne({
        orgId: new Types.ObjectId(org._id),
        tmbId: new Types.ObjectId(targetTmbId as string),
        teamId: new Types.ObjectId(teamId)
      });

      if (result.deletedCount === 0) {
        return jsonRes(res, {
          code: 500,
          error: '删除失败，未找到对应的组织成员记录'
        });
      }

      jsonRes(res, {
        data: {
          orgId: org._id,
          orgName: org.name,
          tmbId: targetTmbId,
          memberName: member.name,
          deletedCount: result.deletedCount,
          deleteTime: new Date()
        },
        message: '组织成员删除成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('删除组织成员失败:', error);
    jsonRes(res, {
      code: 500,
      error: '删除失败'
    });
  }
}
