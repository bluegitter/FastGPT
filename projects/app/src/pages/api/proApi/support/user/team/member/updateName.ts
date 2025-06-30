import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });

    if (req.method === 'PUT') {
      const { name } = req.body;

      // 参数验证
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return jsonRes(res, {
          code: 400,
          error: '姓名不能为空'
        });
      }

      // 更新当前用户的姓名
      const result = await MongoTeamMember.findOneAndUpdate(
        { _id: new Types.ObjectId(tmbId) },
        {
          $set: {
            name: name.trim(),
            updateTime: new Date()
          }
        },
        {
          new: true, // 返回更新后的文档
          runValidators: true
        }
      );

      if (!result) {
        return jsonRes(res, {
          code: 404,
          error: '团队成员不存在'
        });
      }

      jsonRes(res, {
        data: {
          tmbId: result._id,
          name: result.name,
          updateTime: result.updateTime
        },
        message: '姓名更新成功'
      });
    } else {
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('更新团队成员姓名失败:', error);
    jsonRes(res, {
      code: 500,
      error: '更新失败'
    });
  }
}
