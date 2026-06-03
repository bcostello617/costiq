import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2 } from 'lucide-react';
import { formatCurrency, formatNumber, calcCostPerUnit, calcCostPerSF, calcDensity, calcDuration } from '@/lib/costUtils';
import ProjectOverviewTab from '@/components/projects/ProjectOverviewTab';
import ProjectCostsTab from '@/components/projects/ProjectCostsTab';
import ProjectBenchmarkTab from '@/components/projects/ProjectBenchmarkTab';
import ProjectInsightsTab from '@/components/projects/ProjectInsightsTab';

export default function ProjectDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = window.location.pathname.split('/projects/')[1];

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const projects = await db.Project.filter({ id: projectId });
      return projects[0];
    },
    enabled: !!projectId,
  });

  const { data: costs = [] } = useQuery({
    queryKey: ['project-costs', projectId],
    queryFn: () => db.ProjectCost.filter({ project_id: projectId }),
    enabled: !!projectId,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => db.Project.list('-created_date', 500),
  });

  const { data: allCosts = [] } = useQuery({
    queryKey: ['project-costs'],
    queryFn: () => db.ProjectCost.list('-created_date', 5000),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!project) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Project not found</p>
      <Link to="/projects"><Button variant="outline" className="mt-4">Back to Projects</Button></Link>
    </div>
  );

  const costPerUnit = calcCostPerUnit(project.total_hard_cost, project.unit_count);
  const costPerSF = calcCostPerSF(project.total_hard_cost, project.gross_sf);
  const density = calcDensity(project.unit_count, project.site_acres);
  const duration = calcDuration(project.start_date, project.completion_date);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/projects">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{project.project_name}</h1>
            {project.project_number && <span className="text-sm text-muted-foreground font-mono">#{project.project_number}</span>}
            {project.status && <Badge variant="outline">{project.status}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {project.city}{project.state ? `, ${project.state}` : ''} · {project.product_type || 'N/A'} · {project.construction_type || 'N/A'}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Cost', value: formatCurrency(project.total_hard_cost, true) },
          { label: 'Cost/Unit', value: formatCurrency(costPerUnit, true) },
          { label: 'Cost/SF', value: formatCurrency(costPerSF) },
          { label: 'Units', value: formatNumber(project.unit_count) },
          { label: 'Density', value: formatNumber(density, 1) + ' u/ac' },
          { label: 'Duration', value: formatNumber(duration) + ' mo' },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-bold mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="costs">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ProjectOverviewTab project={project} costs={costs} />
        </TabsContent>
        <TabsContent value="costs">
          <ProjectCostsTab project={project} costs={costs} />
        </TabsContent>
        <TabsContent value="benchmark">
          <ProjectBenchmarkTab project={project} costs={costs} allProjects={allProjects} allCosts={allCosts} />
        </TabsContent>
        <TabsContent value="insights">
          <ProjectInsightsTab project={project} costs={costs} allProjects={allProjects} allCosts={allCosts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}