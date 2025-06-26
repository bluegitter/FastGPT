import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId: currentTmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'DELETE') {
      const { tmbId } = req.query;

      if (!tmbId) {
        return jsonRes(res, {
          code: 400,
          error: 'tmbId is required'
        });
      }

      // 查找要删除的成员
      const memberToDelete = await MongoTeamMember.findById(tmbId);
      if (!memberToDelete) {
        return jsonRes(res, {
          code: 404,
          error: 'Member not found'
        });
      }

      // 检查权限：只有团队所有者可以删除成员
      const currentMember = await MongoTeamMember.findById(currentTmbId);
      if (!currentMember) {
        return jsonRes(res, {
          code: 403,
          error: 'Permission denied'
        });
      }

      // 检查是否是团队所有者
      const hasPermission = currentMember.role === TeamMemberRoleEnum.owner;

      if (!hasPermission) {
        return jsonRes(res, {
          code: 403,
          error: 'Only team owner can delete members'
        });
      }

      // 不能删除自己
      if (String(memberToDelete._id) === String(currentTmbId)) {
        return jsonRes(res, {
          code: 400,
          error: 'Cannot delete yourself'
        });
      }

      // 不能删除团队所有者
      if (memberToDelete.role === TeamMemberRoleEnum.owner) {
        return jsonRes(res, {
          code: 400,
          error: 'Cannot delete team owner'
        });
      }

      // 删除成员
      await MongoTeamMember.findByIdAndDelete(tmbId);

      if (memberToDelete.userId) {
        await MongoUser.deleteOne({ _id: memberToDelete.userId });
      }

      jsonRes(res, {
        data: { success: true },
        message: 'Member deleted successfully'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    jsonRes(res, {
      code: 500,
      error
    });
  }
}
