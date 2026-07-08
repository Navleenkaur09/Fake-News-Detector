import { 
  useGetDashboardStats,
  getGetDashboardStatsQueryKey,
  useGetClassDistribution,
  getGetClassDistributionQueryKey,
  useGetModelComparison,
  getGetModelComparisonQueryKey,
  useGetConfusionMatrix,
  getGetConfusionMatrixQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { Database, Brain, Activity, FileText, Target, Crosshair } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey() } });
  const { data: distribution, isLoading: distLoading } = useGetClassDistribution({ query: { queryKey: getGetClassDistributionQueryKey() } });
  const { data: models, isLoading: modelsLoading } = useGetModelComparison({ query: { queryKey: getGetModelComparisonQueryKey() } });
  const { data: matrix, isLoading: matrixLoading } = useGetConfusionMatrix({ query: { queryKey: getGetConfusionMatrixQueryKey() } });

  // Transform distribution data for Recharts
  const pieData = distribution ? [
    { name: "Real News", value: distribution.real, color: "hsl(var(--success))" },
    { name: "Fake News", value: distribution.fake, color: "hsl(var(--destructive))" }
  ] : [];

  // Metrics for the radar chart
  const currentModelMetrics = stats ? [
    { metric: "Accuracy", value: Math.round(stats.accuracy * 100) },
    { metric: "Precision", value: Math.round(stats.precision * 100) },
    { metric: "Recall", value: Math.round(stats.recall * 100) },
    { metric: "F1 Score", value: Math.round(stats.f1Score * 100) },
  ] : [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Model Intelligence</h1>
        <p className="text-muted-foreground">
          System performance metrics, training dataset statistics, and classification boundaries.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Model</CardTitle>
            <Brain className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{stats?.modelName}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Current production version</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Global Accuracy</CardTitle>
            <Target className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold text-success">
                {(stats!.accuracy * 100).toFixed(1)}%
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">On validation dataset</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Training Size</CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold font-mono">
                {stats?.datasetSize.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total articles indexed</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">F1 Score</CardTitle>
            <Crosshair className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">
                {(stats!.f1Score * 100).toFixed(1)}%
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Harmonic mean of precision & recall</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Class Distribution */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Dataset Distribution</CardTitle>
            <CardDescription>Balance of real vs fake articles in training data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full relative flex items-center justify-center">
              {distLoading ? <Loader /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number) => [value.toLocaleString(), "Articles"]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {!distLoading && distribution && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                  <span className="text-3xl font-bold font-mono">
                    {((distribution.real / (distribution.real + distribution.fake)) * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-muted-foreground">Real</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Model Radar */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Model Performance Profile</CardTitle>
            <CardDescription>{stats?.modelName || "Current Model"} metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {statsLoading ? <Loader /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={currentModelMetrics}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                    <RechartsTooltip 
                      formatter={(value: number) => [`${value}%`, ""]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model Comparison */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Algorithm Comparison</CardTitle>
            <CardDescription>Accuracy metrics across evaluated classifier models</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              {modelsLoading ? <Loader /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={models}
                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      domain={[0, 1]} 
                      tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [
                        `${(value * 100).toFixed(1)}%`,
                        name.charAt(0).toUpperCase() + name.slice(1)
                      ]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="accuracy" name="Accuracy" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="f1Score" name="F1 Score" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Confusion Matrix */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Confusion Matrix</CardTitle>
            <CardDescription>True vs Predicted classes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full flex flex-col">
              {matrixLoading ? <Loader /> : matrix && (
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs text-muted-foreground px-8 mb-2">
                    <div className="w-1/2 text-center">Predicted REAL</div>
                    <div className="w-1/2 text-center">Predicted FAKE</div>
                  </div>
                  
                  <div className="flex-1 flex gap-2">
                    <div className="w-8 flex items-center justify-center -rotate-90 text-xs text-muted-foreground whitespace-nowrap">
                      Actual REAL
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <MatrixCell 
                        label="True Positive" 
                        value={matrix.truePositive} 
                        total={matrix.truePositive + matrix.falseNegative} 
                        colorClass="bg-success/20 text-success border-success/30" 
                      />
                      <MatrixCell 
                        label="False Negative" 
                        value={matrix.falseNegative} 
                        total={matrix.truePositive + matrix.falseNegative} 
                        colorClass="bg-destructive/10 text-destructive border-destructive/20" 
                        isError
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 flex gap-2">
                    <div className="w-8 flex items-center justify-center -rotate-90 text-xs text-muted-foreground whitespace-nowrap">
                      Actual FAKE
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <MatrixCell 
                        label="False Positive" 
                        value={matrix.falsePositive} 
                        total={matrix.falsePositive + matrix.trueNegative} 
                        colorClass="bg-destructive/10 text-destructive border-destructive/20" 
                        isError
                      />
                      <MatrixCell 
                        label="True Negative" 
                        value={matrix.trueNegative} 
                        total={matrix.falsePositive + matrix.trueNegative} 
                        colorClass="bg-primary/20 text-primary border-primary/30" 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MatrixCell({ label, value, total, colorClass, isError = false }: { label: string, value: number, total: number, colorClass: string, isError?: boolean }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  
  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-md border ${colorClass} transition-all hover:brightness-110`}>
      <span className="text-3xl font-bold font-mono">{value.toLocaleString()}</span>
      <span className="text-xs font-medium uppercase tracking-wider mt-1 opacity-80">{label}</span>
      <span className="text-xs mt-2 opacity-70 bg-background/50 px-2 py-0.5 rounded-full">
        {percentage.toFixed(1)}%
      </span>
    </div>
  );
}

function Loader() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="animate-pulse flex space-x-2">
        <div className="h-3 w-3 bg-muted-foreground/30 rounded-full"></div>
        <div className="h-3 w-3 bg-muted-foreground/30 rounded-full animation-delay-150"></div>
        <div className="h-3 w-3 bg-muted-foreground/30 rounded-full animation-delay-300"></div>
      </div>
    </div>
  );
}
