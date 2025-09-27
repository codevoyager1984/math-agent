'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { BookOpenIcon } from 'lucide-react';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0 z-[100]">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <span className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer">
                Math Agent
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* 导航链接 */}
        <div className="px-2 py-2">
          <SidebarMenu>
            <div className="flex flex-col gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/knowledge"
                    onClick={() => {
                      setOpenMobile(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted transition-colors text-sm"
                  >
                    <BookOpenIcon className="size-4" />
                    <span>知识库</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  浏览数学知识点
                </TooltipContent>
              </Tooltip>
            </div>
          </SidebarMenu>
        </div>
        
        {/* 聊天历史 */}
        <div className="border-t">
          <SidebarHistory user={user} />
        </div>
      </SidebarContent>
      <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
