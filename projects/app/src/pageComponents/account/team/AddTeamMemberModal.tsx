import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Input,
  ModalBody,
  ModalFooter,
  HStack,
  FormLabel,
  Flex,
  Checkbox
} from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import MySelect from '@fastgpt/web/components/common/MySelect';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { addTeamMember, getTeamList } from '@/web/support/user/team/api';
import { useTranslation } from 'next-i18next';
import type { TeamTmbItemType } from '@fastgpt/global/support/user/team/type.d';
import { useUserStore } from '@/web/support/user/useUserStore';

const AddTeamMemberModal = ({
  isOpen,
  onClose,
  onSuccess = () => {}
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teams, setTeams] = useState<TeamTmbItemType[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { userInfo } = useUserStore();
  const [isAdmin, setIsAdmin] = useState(false);

  // 获取用户可用的团队列表
  const fetchTeams = async () => {
    setIsLoadingTeams(true);
    try {
      const data = await getTeamList('active');
      setTeams(data);
      // 如果有团队，默认选择第一个
      if (data.length > 0) {
        const teamId = userInfo?.team?.teamId;
        setSelectedTeamId(teamId || data[0].teamId);
      }
    } catch (error) {
      console.error('获取团队列表失败:', error);
      toast({ status: 'error', title: '获取团队列表失败' });
    }
    setIsLoadingTeams(false);
  };

  // 当弹窗打开时重置isAdmin
  useEffect(() => {
    if (isOpen) {
      setIsAdmin(false);
      fetchTeams();
    }
  }, [isOpen]);

  // 格式化团队列表为 MySelect 需要的格式
  const teamOptions = teams.map((team) => ({
    label: team.teamName,
    value: team.teamId,
    icon: team.teamAvatar || '/imgs/avatar/TealAvatar.svg',
    iconSize: '1.25rem'
  }));

  const handleAdd = async () => {
    if (!username.trim()) {
      toast({ status: 'warning', title: '请输入用户名' });
      return;
    }
    if (!password.trim()) {
      toast({ status: 'warning', title: '请输入密码' });
      return;
    }
    if (!selectedTeamId) {
      toast({ status: 'warning', title: '请选择团队' });
      return;
    }
    setIsAdding(true);
    try {
      await addTeamMember({
        username: username.trim(),
        password: password.trim(),
        teamId: selectedTeamId,
        isAdmin
      });
      toast({ status: 'success', title: '添加成功' });
      setUsername('');
      setPassword('');
      setSelectedTeamId('');
      setIsAdmin(false);
      onClose();
      onSuccess();
    } catch (e: any) {
      toast({ status: 'error', title: e?.message || '添加失败' });
    }
    setIsAdding(false);
  };

  return (
    <MyModal
      isOpen={isOpen}
      onClose={onClose}
      title="新增用户"
      iconSrc="common/userLight"
      maxW={['90vw', '400px']}
    >
      <ModalBody>
        <Flex direction="column" gap={4}>
          <Flex align="center">
            <FormLabel minW="70px" m={0}>
              用户名
            </FormLabel>
            <Input
              placeholder="请输入用户名（邮箱或手机号）"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </Flex>
          <Flex align="center">
            <FormLabel minW="70px" m={0}>
              密码
            </FormLabel>
            <Input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </Flex>
          <Flex align="center">
            <FormLabel minW="70px" m={0}>
              所属团队
            </FormLabel>
            <Box flex={1}>
              <MySelect
                list={teamOptions}
                value={selectedTeamId}
                onChange={(value) => setSelectedTeamId(value)}
                placeholder="请选择团队"
                isLoading={isLoadingTeams}
              />
            </Box>
          </Flex>
          <Flex align="center">
            <FormLabel minW="70px" m={0}>
              设置为团队管理员
            </FormLabel>
            <Checkbox isChecked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)}>
              设为管理员
            </Checkbox>
          </Flex>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button isLoading={isAdding} colorScheme="blue" onClick={handleAdd}>
          确认添加
        </Button>
        <Button ml={3} onClick={onClose}>
          取消
        </Button>
      </ModalFooter>
    </MyModal>
  );
};

export default AddTeamMemberModal;
