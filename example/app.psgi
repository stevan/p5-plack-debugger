#!/usr/bin/env perl

use strict;
use warnings;

use Plack::Builder;
use Plack::Request; 

use JSON::XS;
use Path::Class qw[ dir ];
use UUID::Tiny  qw[ create_uuid_as_string UUID_V4 ];
use Time::HiRes qw[ gettimeofday tv_interval ];

use Plack::Debugger;
use Plack::Debugger::Storage;

use Plack::App::Debugger;

my $JSON         = JSON::XS->new->utf8->pretty;
my $DATA_DIR     = dir('/tmp/debugger_panel');
my $DEBUGGER_URL = Plack::App::Debugger->DEFAULT_BASE_URL;

mkdir $DATA_DIR unless -e $DATA_DIR;

my $debugger = Plack::Debugger->new(
    uid_generator => sub { create_uuid_as_string(UUID_V4) },
    storage => Plack::Debugger::Storage->new(
        data_dir     => $DATA_DIR,
        serializer   => sub { $JSON->encode( shift ) },
        deserializer => sub { $JSON->decode( shift ) },
        filename_fmt => "%s.json",
    ),
    panels => [
        Plack::Debugger::Panel->new(
            title     => 'Timer',
            subtitle  => '... timing the response',
            before    => sub { 
                my ($self, $env) = @_;
                $self->stash([ gettimeofday ]); 
            },
            after     => sub { 
                my ($self, $env, $resp) = @_;
                $self->set_result( tv_interval( $self->stash, [ gettimeofday ]) );
            }
        ),
        Plack::Debugger::Panel->new(
            title     => 'Env',
            subtitle  => '... capturing the execution env',
            before    => sub { 
                my ($self, $env) = @_;
                $self->set_result({ %ENV }); 
            }
        )
    ]
);

my $debugger_application = Plack::App::Debugger->new( debugger => $debugger );

builder {

    mount $DEBUGGER_URL => $debugger_application->to_app;

    mount '/' => builder {
        enable $debugger_application->make_injector_middleware;
        enable $debugger->make_collector_middleware;

        sub {
            my $r = Plack::Request->new( shift );
            [ 
                200, 
                [ 'Content-Type' => 'text/html' ], 
                [q[
                    <html>
                    <head>
                        <title>Plack::Debugger - Test</title>
                    </head>
                    <body>
                        <h1>Plack::Debugger Test</h1>
                        <hr/>
                        <p>This is a test of the Plack-Debugger</p>
                    </body>
                    </html>
                ]]
            ]
        }
    }
};



