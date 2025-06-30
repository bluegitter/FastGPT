import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum
} from '@fastgpt/global/support/user/team/constant';
import { hashStr } from '@fastgpt/global/common/string/tools';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 权限验证
    const { tmbId, teamId } = await authCert({ req, authToken: true });
    console.log('权限验证通过:', { tmbId, teamId });

    if (req.method === 'POST') {
      const {
        username,
        password,
        teamId: requestTeamId,
        role = TeamMemberRoleEnum.member
      } = req.body;
      console.log('解析请求参数:', {
        username,
        password: password ? '***' : 'undefined',
        requestTeamId,
        role
      });

      // 参数验证
      if (!username || !username.trim()) {
        console.log('用户名验证失败: 用户名为空');
        return jsonRes(res, {
          code: 400,
          error: '用户名不能为空'
        });
      }

      if (!password || !password.trim()) {
        console.log('密码验证失败: 密码为空');
        return jsonRes(res, {
          code: 400,
          error: '密码不能为空'
        });
      }

      // 使用请求中的 teamId 或当前用户的 teamId
      const targetTeamId = requestTeamId || teamId;

      // 查找用户
      const existUser = await MongoUser.findOne({ username: username.trim() });
      if (existUser) {
        console.log('用户名已存在:', username);
        return jsonRes(res, {
          code: 400,
          error: '用户名已存在'
        });
      }

      console.log('开始创建新用户...');
      const hashedPassword = hashStr(password.trim());
      const newUser = new MongoUser({
        username: username.trim(),
        password: hashedPassword,
        status: 'active',
        avatar: '/icon/human.svg',
        timezone: 'Asia/Shanghai',
        createTime: Date.now()
      });

      const user = await newUser.save();
      console.log('用户创建成功:', user._id);

      // 创建团队成员
      console.log('开始创建团队成员...');
      const newMember = await MongoTeamMember.create({
        userId: user._id,
        teamId: targetTeamId,
        name: user.username,
        role: role,
        status: TeamMemberStatusEnum.active,
        avatar: '/icon/human.svg',
        createTime: new Date()
      });

      console.log('团队成员创建成功:', newMember._id);

      jsonRes(res, {
        data: newMember,
        message: '用户添加成功'
      });
    } else {
      console.log('不支持的HTTP方法:', req.method);
      jsonRes(res, {
        code: 405,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('添加团队成员失败:', error);
    jsonRes(res, {
      code: 500,
      error: error instanceof Error ? error.message : '添加团队成员失败'
    });
  }
}
