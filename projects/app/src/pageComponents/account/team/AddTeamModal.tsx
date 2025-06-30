import React, { useState } from 'react';
import { Box, Button, Input, ModalBody, ModalFooter, Flex, FormLabel } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { postCreateTeam } from '@/web/support/user/team/api';
import { useTranslation } from 'next-i18next';

interface AddTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AddTeamModal = ({ isOpen, onClose, onSuccess = () => {} }: AddTeamModalProps) => {
  const [teamName, setTeamName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  // 设置默认团队头像
  const defaultTeamAvatar = '/imgs/avatar/TealAvatar.svg';

  const handleAdd = async () => {
    if (!teamName.trim()) {
      toast({ status: 'warning', title: '请输入团队名称' });
      return;
    }
    setIsAdding(true);
    try {
      await postCreateTeam({
        name: teamName.trim(),
        avatar: defaultTeamAvatar
      });

      toast({ status: 'success', title: '团队创建成功' });
      setTeamName('');
      onClose();
      onSuccess();
    } catch (e: any) {
      toast({ status: 'error', title: e?.message || '创建失败' });
    }
    setIsAdding(false);
  };

  return (
    <MyModal
      isOpen={isOpen}
      onClose={onClose}
      title="新增团队"
      iconSrc="common/add"
      maxW={['90vw', '400px']}
    >
      <ModalBody>
        <Flex direction="column" gap={4}>
          <Flex align="center">
            <FormLabel minW="70px" m={0}>
              团队名称
            </FormLabel>
            <Input
              placeholder="请输入团队名称"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
          </Flex>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button isLoading={isAdding} colorScheme="blue" onClick={handleAdd}>
          确认创建
        </Button>
        <Button ml={3} onClick={onClose}>
          取消
        </Button>
      </ModalFooter>
    </MyModal>
  );
};

export default AddTeamModal;
