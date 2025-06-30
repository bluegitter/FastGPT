import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限校验
    const { teamId } = await authCert({ req, authToken: true });

    if (req.method !== 'POST') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }

    const { name, avatar } = req.body;

    if (!name || !name.trim()) {
      return jsonRes(res, { code: 400, error: '群组名称不能为空' });
    }

    // 检查同团队下是否重名
    const exist = await MongoMemberGroupModel.findOne({ teamId, name: name.trim() });
    if (exist) {
      return jsonRes(res, { code: 400, error: '群组名称已存在' });
    }

    // 创建群组
    const group = await MongoMemberGroupModel.create({
      teamId,
      name: name.trim(),
      avatar: avatar || '/icon/group.svg'
    });

    jsonRes(res, {
      data: {
        groupId: group._id,
        name: group.name,
        avatar: group.avatar
      },
      message: '群组创建成功'
    });
  } catch (error) {
    jsonRes(res, { code: 500, error: error instanceof Error ? error.message : '创建失败' });
  }
}
