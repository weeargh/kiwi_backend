<template>
  <el-aside width="220px" class="sidebar-container">
    <div class="logo-container">
      <div class="logo">K3</div>
    </div>
    <el-scrollbar>
      <el-menu
        :default-openeds="['1']"
        :default-active="activeMenu"
        class="sidebar-menu"
        router
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>Dashboard</span>
        </el-menu-item>
        
        <el-menu-item index="/pool">
          <el-icon><OfficeBuilding /></el-icon>
          <span>Pool</span>
        </el-menu-item>

        <el-menu-item index="/employees">
          <el-icon><Avatar /></el-icon>
          <span>Employee</span>
        </el-menu-item>

        <el-menu-item index="/grants">
          <el-icon><List /></el-icon>
          <span>Grant</span>
        </el-menu-item>

        <el-menu-item index="/audit-logs">
          <el-icon><Document /></el-icon>
          <span>Audit Log</span>
        </el-menu-item>

        <el-menu-item index="/settings">
          <el-icon><Tools /></el-icon>
          <span>Setting</span>
        </el-menu-item>
      </el-menu>
    </el-scrollbar>
  </el-aside>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  HomeFilled,
  PriceTag,
  OfficeBuilding,
  Briefcase,
  Tools,
  Document,
  Avatar,
  List
} from '@element-plus/icons-vue';

const route = useRoute();
const activeMenu = computed(() => route.path);
</script>

<style scoped>
.sidebar-container {
  background-color: var(--sidebar-bg-color);
  height: calc(100vh - 60px); /* Full height minus header */
  position: sticky; 
  top: 60px; /* Positioned below the header */
  border-right: 1px solid var(--el-color-primary-light-3);
  display: flex;
  flex-direction: column;
  z-index: 1; /* Lower than header */
}

.logo-container {
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid var(--el-color-primary-light-3);
}

.logo {
  font-size: 28px;
  font-weight: bold;
  color: var(--sidebar-text-color);
  text-align: center;
  background-color: var(--el-color-primary-dark-2);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  line-height: 40px;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 100%;
  border-right: none;
  background-color: var(--sidebar-bg-color);
}

.el-menu-item,
:deep(.el-sub-menu__title) {
  color: var(--sidebar-text-color);
  background-color: transparent !important;
}

.el-menu-item .el-icon,
:deep(.el-sub-menu__title .el-icon) {
  color: var(--sidebar-text-color);
}

.el-menu-item:hover,
:deep(.el-sub-menu__title:hover) {
  background-color: var(--sidebar-hover-bg-color) !important;
}

.el-menu-item.is-active {
  background-color: var(--sidebar-active-bg-color) !important;
  color: var(--sidebar-active-text-color) !important;
  border-right: 3px solid var(--sidebar-border-color);
}

.el-menu-item.is-active .el-icon {
  color: var(--sidebar-active-text-color) !important;
}

.el-icon {
  margin-right: 10px;
}
</style>
