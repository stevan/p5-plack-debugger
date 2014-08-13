#!/usr/bin/perl

use strict;
use warnings;

use Test::More;

use Plack::Test;    
use HTTP::Request::Common qw[ GET ];
use Path::Class           qw[ dir ];

BEGIN {
    use_ok('Plack::Debugger');
}

my $DATA_DIR = dir('./t/tmp');

my $debugger = Plack::Debugger->new(
    data_dir => $DATA_DIR,
    panels   => [
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
                $self->set_result( $self->stash ); 
            },
        )
    ]
);


my $app = sub {
    my $env = shift;
    [ 200, [], [ 'HELLO WORLD from ' . $env->{'PATH_INFO'} ]]
};

test_psgi(
    Plack::Middleware::Debugger::Collector->wrap( 
        $app,
        ( 
            debugger => $debugger 
        )
    ),
    sub {
        my $cb  = shift;
        {
            my $res = $cb->(GET '/test');  
            is($res->content, 'HELLO WORLD from /test', '... got the right content');

            is_deeply(
                [ map { $_->get_result } @{ $debugger->panels } ],
                [
                    [
                        'started request at /test',
                        'finished request with status 200'
                    ]
                ],
                '... got the expected collected data'
            );
        }
    }
);

done_testing;







