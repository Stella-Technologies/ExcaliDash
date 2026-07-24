{{/*
Expand the chart name.
*/}}
{{- define "excalidash.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "excalidash.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "excalidash.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "excalidash.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: {{ .Values.component }}
app.kubernetes.io/part-of: excalidash
{{- end }}

{{/*
Selector labels for a component.
*/}}
{{- define "excalidash.selectorLabels" -}}
app.kubernetes.io/name: {{ include "excalidash.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: {{ .Values.component }}
{{- end }}

{{/*
Backend fullname.
*/}}
{{- define "excalidash.backend.fullname" -}}
{{- include "excalidash.fullname" . }}-backend
{{- end }}

{{/*
Frontend fullname.
*/}}
{{- define "excalidash.frontend.fullname" -}}
{{- include "excalidash.fullname" . }}-frontend
{{- end }}

{{/*
Service account name.
*/}}
{{- define "excalidash.serviceAccountName" -}}
{{- include "excalidash.fullname" . }}-sa
{{- end }}

{{/*
Migration job name.
*/}}
{{- define "excalidash.migrationJobName" -}}
{{- include "excalidash.fullname" . }}-migration
{{- end }}

{{/*
Database provider (env variable-friendly).
*/}}
{{- define "excalidash.databaseProvider" -}}
{{- if .Values.postgresql.enabled -}}postgresql{{- else -}}sqlite{{- end }}
{{- end }}

{{/*
Database URL.
*/}}
{{- define "excalidash.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "postgresql://%s:%s@%s:%s/%s" .Values.postgresql.username .Values.postgresql.password .Values.postgresql.host (.Values.postgresql.port | toString) .Values.postgresql.database }}
{{- else }}
{{- "file:/app/prisma/dev.db" }}
{{- end }}
{{- end }}
