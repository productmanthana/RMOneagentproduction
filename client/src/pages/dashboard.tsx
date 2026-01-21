import { useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { DollarSign, TrendingUp, Award, BarChart3, GripVertical } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  ChartDataLabels
);

interface DashboardData {
  summary: {
    total_projects: string;
    total_value: string;
    avg_fee: string;
    avg_win_rate: string;
  };
  sizeDistribution: Array<{ project_size: string; count: string; total_value: string }>;
  statusDistribution: Array<{ Status: string; count: string; total_value: string }>;
  categoryDistribution: Array<{ category: string; count: string; total_value: string }>;
  stateDistribution: Array<{ state: string; count: string; total_value: string }>;
  monthlyTrend: Array<{ month: string; count: string; total_value: string }>;
  topProjects: Array<{ "Project Name": string; fee: string; Status: string; category: string }>;
  winRateByCategory: Array<{ category: string; total_projects: string; avg_win_rate: string; total_value: string }>;
}

interface ChartCard {
  id: string;
  title: string;
  description: string;
  component: ReactNode;
  testId: string;
  number: number;
  colSpan?: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  } else if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ["/api/dashboard/analytics"],
  });

  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [chartOrder, setChartOrder] = useState<string[]>([
    'size', 'status', 'category', 'geographic', 'timeline', 'winrate', 'topprojects'
  ]);

  useEffect(() => {
    const savedOrder = localStorage.getItem('dashboardChartOrder');
    if (savedOrder) {
      try {
        setChartOrder(JSON.parse(savedOrder));
      } catch (e) {
      }
    }
  }, []);

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCard(cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetCardId: string) => {
    e.preventDefault();
    
    if (!draggedCard || draggedCard === targetCardId) {
      setDraggedCard(null);
      return;
    }

    const newOrder = [...chartOrder];
    const draggedIndex = newOrder.indexOf(draggedCard);
    const targetIndex = newOrder.indexOf(targetCardId);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedCard);

    setChartOrder(newOrder);
    localStorage.setItem('dashboardChartOrder', JSON.stringify(newOrder));
    setDraggedCard(null);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        <header className="bg-[#3A4A57] border-b border-[#4B5563]">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-8 w-48 bg-white/20" />
                <Skeleton className="h-4 w-64 mt-2 bg-white/20" />
              </div>
              <Skeleton className="h-10 w-32 bg-white/20" />
            </div>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 bg-[#E5E7EB]" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-96 bg-[#E5E7EB]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Card className="max-w-md bg-white border border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#111827]">Error Loading Dashboard</CardTitle>
            <CardDescription className="text-[#6B7280]">Failed to fetch dashboard analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-[#9CA3AF] mb-4">
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </p>
            <Button 
              onClick={() => window.location.reload()} 
              className="bg-[#3B82F6] hover:bg-[#1D4ED8] text-white"
              data-testid="button-retry"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const analytics = data.data;
  const summary = analytics.summary;

  const primaryColors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(249, 115, 22, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(168, 85, 247, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(20, 184, 166, 0.8)',
  ];

  const borderColors = primaryColors.map(c => c.replace('0.8', '1'));

  const sizeChartData = {
    labels: analytics.sizeDistribution.map(d => d.project_size),
    datasets: [{
      label: 'Projects',
      data: analytics.sizeDistribution.map(d => parseInt(d.count)),
      backgroundColor: primaryColors.slice(0, analytics.sizeDistribution.length),
      borderColor: borderColors.slice(0, analytics.sizeDistribution.length),
      borderWidth: 1,
    }],
  };

  const statusChartData = {
    labels: analytics.statusDistribution.map(d => d.Status),
    datasets: [{
      label: 'Projects',
      data: analytics.statusDistribution.map(d => parseInt(d.count)),
      backgroundColor: primaryColors,
      borderColor: borderColors,
      borderWidth: 1,
    }],
  };

  const categoryChartData = {
    labels: analytics.categoryDistribution.slice(0, 8).map(d => d.category),
    datasets: [{
      label: 'Projects',
      data: analytics.categoryDistribution.slice(0, 8).map(d => parseInt(d.count)),
      backgroundColor: primaryColors,
      borderColor: borderColors,
      borderWidth: 2,
    }],
  };

  const stateChartData = {
    labels: analytics.stateDistribution.slice(0, 10).map(d => d.state),
    datasets: [{
      label: 'Projects',
      data: analytics.stateDistribution.slice(0, 10).map(d => parseInt(d.count)),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 1,
    }],
  };

  const monthlyTrendData = {
    labels: analytics.monthlyTrend.map(d => d.month),
    datasets: [{
      label: 'Project Count',
      data: analytics.monthlyTrend.map(d => parseInt(d.count)),
      borderColor: 'rgba(59, 130, 246, 1)',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      fill: true,
      tension: 0.4,
    }],
  };

  const winRateChartData = {
    labels: analytics.winRateByCategory.map(d => d.category),
    datasets: [{
      label: 'Avg Win Rate (%)',
      data: analytics.winRateByCategory.map(d => parseFloat(d.avg_win_rate)),
      backgroundColor: 'rgba(139, 195, 74, 0.8)',
      borderColor: 'rgba(139, 195, 74, 1)',
      borderWidth: 1,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#374151',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#6B7280',
        },
        grid: {
          color: '#E5E7EB',
        },
      },
      y: {
        ticks: {
          color: '#6B7280',
        },
        grid: {
          color: '#E5E7EB',
        },
      },
    },
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#374151',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        borderColor: '#E5E7EB',
        borderWidth: 1,
      },
      datalabels: {
        color: '#fff',
        font: {
          weight: 'bold' as const,
          size: 12,
        },
        formatter: (value: number) => {
          return value > 0 ? value : '';
        },
      },
    },
  };

  const barChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      datalabels: {
        color: '#374151',
        anchor: 'end' as const,
        align: 'end' as const,
        font: {
          weight: 'bold' as const,
          size: 11,
        },
        formatter: (value: number) => {
          return value > 0 ? value : '';
        },
      },
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        beginAtZero: true,
      },
    },
  };

  const lineChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      datalabels: {
        color: '#fff',
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 4,
        padding: 4,
        font: {
          weight: 'bold' as const,
          size: 10,
        },
        formatter: (value: number) => {
          return value > 0 ? value : '';
        },
      },
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        beginAtZero: true,
      },
    },
  };

  const winRateChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      datalabels: {
        color: '#374151',
        anchor: 'end' as const,
        align: 'top' as const,
        offset: 4,
        font: {
          weight: 'bold' as const,
          size: 11,
        },
        formatter: (value: number) => {
          return value > 0 ? `${value.toFixed(1)}%` : '';
        },
      },
    },
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        beginAtZero: true,
        max: 100,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: function(value: any) {
            return value + '%';
          },
        },
      },
    },
  };

  const allChartCards: Record<string, ChartCard> = {
    size: {
      id: 'size',
      number: 1,
      title: 'Project Distribution by Size',
      description: 'Number of projects in each size category',
      testId: 'chart-size-distribution',
      component: (
        <div className="h-80">
          <Doughnut data={sizeChartData} options={pieChartOptions} />
        </div>
      ),
    },
    status: {
      id: 'status',
      number: 2,
      title: 'Projects by Status',
      description: 'Current status of all projects',
      testId: 'chart-status-distribution',
      component: (
        <div className="h-80">
          <Pie data={statusChartData} options={pieChartOptions} />
        </div>
      ),
    },
    category: {
      id: 'category',
      number: 3,
      title: 'Top Categories',
      description: 'Projects by request category (top 8)',
      testId: 'chart-category-distribution',
      component: (
        <div className="h-80">
          <Bar data={categoryChartData} options={barChartOptions} />
        </div>
      ),
    },
    geographic: {
      id: 'geographic',
      number: 4,
      title: 'Geographic Distribution',
      description: 'Projects by state (top 10)',
      testId: 'chart-geographic-distribution',
      component: (
        <div className="h-80">
          <Bar data={stateChartData} options={barChartOptions} />
        </div>
      ),
    },
    timeline: {
      id: 'timeline',
      number: 5,
      title: 'Project Timeline',
      description: 'Projects over the last 12 months',
      testId: 'chart-monthly-trend',
      colSpan: 'lg:col-span-2',
      component: (
        <div className="h-80">
          <Line data={monthlyTrendData} options={lineChartOptions} />
        </div>
      ),
    },
    winrate: {
      id: 'winrate',
      number: 6,
      title: 'Win Rate by Category',
      description: 'Average win percentage by category',
      testId: 'chart-win-rate',
      component: (
        <div className="h-80">
          <Bar data={winRateChartData} options={winRateChartOptions} />
        </div>
      ),
    },
    topprojects: {
      id: 'topprojects',
      number: 7,
      title: 'Top 10 Projects by Fee',
      description: 'Highest value projects',
      testId: 'table-top-projects',
      component: (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[#E5E7EB] sticky top-0 bg-[#F9FAFB]">
              <tr className="text-left">
                <th className="pb-2 font-medium text-[#374151]">Project</th>
                <th className="pb-2 font-medium text-right text-[#374151]">Fee</th>
                <th className="pb-2 font-medium text-[#374151]">Status</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topProjects.map((project, idx) => (
                <tr key={idx} className="border-b border-[#F3F4F6] last:border-0" data-testid={`row-project-${idx}`}>
                  <td className="py-2 text-[#6B7280] max-w-[200px] truncate" title={project["Project Name"]}>
                    {project["Project Name"]}
                  </td>
                  <td className="py-2 text-right font-medium text-[#111827]">
                    {formatCurrency(parseFloat(project.fee))}
                  </td>
                  <td className="py-2">
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-[#E8F5E9] text-[#558B2F] border border-[#8BC34A]/30">
                      {project.Status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-[#3A4A57] border-b border-[#4B5563]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white" data-testid="text-dashboard-title">RMOne Business Insights</h1>
              <p className="text-white/70 mt-1">Comprehensive overview of all projects</p>
            </div>
            <Link href="/">
              <Button 
                variant="outline" 
                className="bg-white/10 text-white hover:bg-white/20 border-white/30"
                data-testid="button-back-to-chat"
              >
                Back to Chat
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white border border-[#E5E7EB] shadow-sm" data-testid="card-total-projects">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Total Projects</CardTitle>
              <BarChart3 className="h-4 w-4 text-[#3B82F6]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111827]" data-testid="text-total-projects">
                {formatNumber(parseInt(summary.total_projects))}
              </div>
              <p className="text-xs text-[#9CA3AF]">All time</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#E5E7EB] shadow-sm" data-testid="card-total-value">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-[#8BC34A]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111827]" data-testid="text-total-value">
                {formatCurrency(parseFloat(summary.total_value))}
              </div>
              <p className="text-xs text-[#9CA3AF]">Combined fees</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#E5E7EB] shadow-sm" data-testid="card-avg-fee">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Average Fee</CardTitle>
              <TrendingUp className="h-4 w-4 text-[#8B5CF6]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111827]" data-testid="text-avg-fee">
                {formatCurrency(parseFloat(summary.avg_fee))}
              </div>
              <p className="text-xs text-[#9CA3AF]">Per project</p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#E5E7EB] shadow-sm" data-testid="card-avg-win-rate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Avg Win Rate</CardTitle>
              <Award className="h-4 w-4 text-[#F59E0B]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111827]" data-testid="text-avg-win-rate">
                {parseFloat(summary.avg_win_rate).toFixed(1)}%
              </div>
              <p className="text-xs text-[#9CA3AF]">Success rate</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chartOrder.map((cardId) => {
            const card = allChartCards[cardId];
            if (!card) return null;

            return (
              <Card
                key={card.id}
                className={`bg-white border border-[#E5E7EB] shadow-sm cursor-move hover:border-[#3B82F6]/50 hover:shadow-md transition-all ${
                  draggedCard === card.id ? 'opacity-50' : ''
                } ${card.colSpan || ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, card.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, card.id)}
                onDragEnd={handleDragEnd}
                data-testid={card.testId}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#3B82F6] text-white text-xs font-bold">
                          {card.number}
                        </div>
                        <CardTitle className="text-[#111827] text-lg">{card.title}</CardTitle>
                      </div>
                      <CardDescription className="text-[#6B7280]">{card.description}</CardDescription>
                    </div>
                    <GripVertical className="h-5 w-5 text-[#9CA3AF] shrink-0 mt-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  {card.component}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
