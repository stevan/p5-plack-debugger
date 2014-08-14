#!/usr/bin/perl

use strict;
use warnings;

use Test::More;

use Plack::Builder;

use Plack::Test::Debugger;    
use HTTP::Request::Common qw[ GET ];
use Path::Class           qw[ dir ];
use JSON::XS;

BEGIN {
    use_ok('Plack::Debugger');
    use_ok('Plack::Debugger::Storage');

    use_ok('Plack::App::Debugger');

    use_ok('Plack::Middleware::Debugger::Collector');
    use_ok('Plack::Middleware::Debugger::Injector');
}

my $FILE_ID  = 0;
my $DATA_DIR = dir('./t/tmp/');
my $JSON     = JSON::XS->new->utf8->pretty;

# cleanup tmp dir
{ -f $_ && $_->remove foreach $DATA_DIR->children( no_hidden => 1 ) }

my $debugger = Plack::Debugger->new(
    storage => Plack::Debugger::Storage->new(
        data_dir     => $DATA_DIR,
        serializer   => sub { $JSON->encode( shift ) },
        deserializer => sub { $JSON->decode( shift ) },
        filename_gen => sub { sprintf "test-%03d.json" => ++$FILE_ID },
    ),
    panels  => [
        Plack::Debugger::Panel->new(
            title     => 'Tester',
            subtitle  => '... testing all the things',
            before    => sub { 
                my ($self, $env) = @_;
                $self->stash([ 'started request at ' . $env->{'PATH_INFO'} ]); 
            },
            after     => sub { 
                my ($self, $env, $resp) = @_;
                push @{ $self->stash } => 'finished request with status ' . $resp->[0];
            },
            cleanup   => sub {
                my ($self, $env) = @_;
                push @{ $self->stash } => 'cleaning up request';
                $self->set_result( $self->stash ); 
            }
        )
    ]
);


my $INJECTED = q[<script src="/debugger/debugger.js"></script>];

my $app = builder {

    mount '/debugger' => Plack::App::Debugger->new( debugger => $debugger )->to_app;

    mount '/' => builder {
        enable 'Plack::Middleware::Debugger::Injector'  => ( debugger => $debugger, content => $INJECTED );
        enable 'Plack::Middleware::Debugger::Collector' => ( debugger => $debugger );
        sub {
            my $env = shift;
            [ 
                200, 
                [ 
                    'Content-Type'   => 'text/html',
                    'Content-Length' => 37
                ], 
                [ '<html><body>HELLO WORLD</body></html>' ]
            ]
        }
    }
};

test_psgi($app, sub {
        my $cb  = shift;
        {
            my $data_file = $DATA_DIR->file('test-001.json');

            ok(!-e $data_file, '... no data has been written yet');

            my $resp = $cb->(GET '/');  

            is($resp->headers->header('Content-Length'), 37 + length($INJECTED), '... got the expected expanded Content-Length');
            is(
                $resp->content, 
                '<html><body>HELLO WORLD' . $INJECTED . '</body></html>', 
                '... got the right content'
            );

            ok(-e $data_file, '... data has now been written');

            is_deeply(
                $debugger->storage->load( $data_file->basename ),
                {
                    'Tester' => [
                        'started request at /',
                        'finished request with status 200',
                        'cleaning up request'
                    ]
                },
                '... got the expected collected data in the data-dir'
            );
        }
    }
);

done_testing;







