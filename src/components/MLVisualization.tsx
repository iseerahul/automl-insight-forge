import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter, Cell, PieChart, Pie } from 'recharts';

interface MLVisualizationProps {
  results: any;
  problemType: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const MLVisualization: React.FC<MLVisualizationProps> = ({ results, problemType }) => {
  if (!results || !results.chart_data) {
    return null;
  }

  const renderClassificationCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Confusion Matrix */}
      {results.confusion_matrix && (
        <Card>
          <CardHeader>
            <CardTitle>Confusion Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
              {results.confusion_matrix.map((row: number[], i: number) =>
                row.map((value: number, j: number) => (
                  <div
                    key={`${i}-${j}`}
                    className="aspect-square flex items-center justify-center bg-primary/10 rounded text-lg font-semibold"
                  >
                    {value}
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 text-center">
              <div className="text-sm text-muted-foreground">
                Predicted: Negative (left) | Positive (right)
              </div>
              <div className="text-sm text-muted-foreground">
                Actual: Negative (top) | Positive (bottom)
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accuracy Over Time */}
      {results.chart_data.accuracy_over_time && (
        <Card>
          <CardHeader>
            <CardTitle>Training Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={results.chart_data.accuracy_over_time}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="iteration" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="accuracy" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderRegressionCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Actual vs Predicted */}
      {results.chart_data.scatter_plot && (
        <Card>
          <CardHeader>
            <CardTitle>Actual vs Predicted</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart data={results.chart_data.scatter_plot}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" name="Input" />
                <YAxis />
                <Tooltip />
                <Scatter name="Actual" dataKey="actual" fill="#8884d8" />
                <Scatter name="Predicted" dataKey="predicted" fill="#82ca9d" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Residuals Plot */}
      {results.chart_data.residuals && (
        <Card>
          <CardHeader>
            <CardTitle>Residuals Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart data={results.chart_data.residuals}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="predicted" name="Predicted" />
                <YAxis dataKey="residual" name="Residual" />
                <Tooltip />
                <Scatter dataKey="residual" fill="#ff7300" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderClusteringCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Cluster Scatter Plot */}
      {results.chart_data.scatter_plot && (
        <Card>
          <CardHeader>
            <CardTitle>Cluster Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart data={results.chart_data.scatter_plot}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" />
                <YAxis dataKey="y" />
                <Tooltip />
                <Scatter dataKey="y" fill="#8884d8" />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Cluster Distribution */}
      {results.cluster_distribution && (
        <Card>
          <CardHeader>
            <CardTitle>Cluster Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={results.cluster_distribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ cluster, percentage }) => `${cluster}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {results.cluster_distribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {problemType === 'classification' && renderClassificationCharts()}
      {problemType === 'regression' && renderRegressionCharts()}
      {problemType === 'clustering' && renderClusteringCharts()}

      {/* Feature Importance */}
      {results.feature_importance && (
        <Card>
          <CardHeader>
            <CardTitle>Feature Importance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={results.feature_importance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="feature" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="importance" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};